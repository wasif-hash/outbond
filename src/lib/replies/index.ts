import { Prisma, ReplyDisposition } from "@prisma/client"
import { google, gmail_v1 } from "googleapis"

import { prisma } from "@/lib/prisma"
import { ensureFreshGmailToken, createAuthorizedGmailClient } from "@/lib/google-gmail"

import { classifyReplyContent, createExtractedSummary } from "./classifier"
import type { ReplyRecord } from "./types"

const DISPOSITION_LABEL_MAP: Record<ReplyDisposition, ReplyRecord["disposition"]> = {
  [ReplyDisposition.NO_RESPONSE]: "no response",
  [ReplyDisposition.POSITIVE]: "positive",
  [ReplyDisposition.NEUTRAL]: "neutral",
  [ReplyDisposition.NOT_INTERESTED]: "not interested",
  [ReplyDisposition.UNSUB]: "unsub",
  [ReplyDisposition.BOUNCED]: "bounced",
}

function stripHtml(input: string): string {
  return decodeHtmlEntities(
    input
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim()
}

function buildLeadName({ firstName, lastName, email }: { firstName?: string | null; lastName?: string | null; email: string }): string {
  const parts = [firstName?.trim() ?? "", lastName?.trim() ?? ""].filter(Boolean)
  if (parts.length === 0) {
    return email
  }
  return parts.join(" ")
}

function ensurePlainBody(reply: {
  bodyPlain: string | null
  bodyHtml: string | null
}): string | null {
  if (reply.bodyPlain && reply.bodyPlain.trim()) {
    return reply.bodyPlain
  }
  if (reply.bodyHtml && reply.bodyHtml.trim()) {
    return normalizeWhitespace(stripHtml(reply.bodyHtml))
  }
  return null
}

function normalizeClassifier(model: string | null): "openai" | "heuristic" | null {
  if (!model) return null
  if (model.startsWith("openai:")) return "openai"
  if (model.startsWith("heuristic")) return "heuristic"
  return null
}

const DEFAULT_REPLY_SYNC_LOOKBACK_DAYS = 30
const DEFAULT_REPLY_SYNC_MAX_RESULTS = 75
const DEFAULT_REPLY_SYNC_FETCH_BATCH = 10

const REPLY_SYNC_LOOKBACK_DAYS = (() => {
  const parsed = Number(process.env.REPLY_SYNC_LOOKBACK_DAYS ?? "")
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_REPLY_SYNC_LOOKBACK_DAYS
})()

const REPLY_SYNC_MAX_RESULTS = (() => {
  const parsed = Number(process.env.REPLY_SYNC_MAX_RESULTS ?? "")
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 250) : DEFAULT_REPLY_SYNC_MAX_RESULTS
})()

const REPLY_SYNC_FETCH_BATCH = (() => {
  const parsed = Number(process.env.REPLY_SYNC_FETCH_BATCH ?? "")
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 25) : DEFAULT_REPLY_SYNC_FETCH_BATCH
})()

type RawEmailReply = Prisma.EmailReplyGetPayload<{
  include: {
    emailSendJob: {
      include: {
        campaign: true
      }
    }
    lead: true
    campaign: true
  }
}>

function mapToReplyRecord(reply: RawEmailReply): ReplyRecord {
  const leadFirstName = reply.lead?.firstName ?? reply.emailSendJob?.leadFirstName ?? null
  const leadLastName = reply.lead?.lastName ?? reply.emailSendJob?.leadLastName ?? null
  const leadCompany = reply.lead?.company ?? reply.emailSendJob?.leadCompany ?? null

  const campaignName =
    reply.campaign?.name ??
    reply.emailSendJob?.campaign?.name ??
    reply.emailSendJob?.manualCampaignName ??
    null

  const plainBody = ensurePlainBody(reply)
  const fullReply = plainBody ?? ""
  const extractedSummary = fullReply ? createExtractedSummary(fullReply) : null
  const snippet = reply.snippet ?? extractedSummary?.snippet ?? ""
  const safeSnippet = snippet || "No preview available."

  const dispositionLabel = DISPOSITION_LABEL_MAP[reply.disposition] ?? "neutral"

  const classificationSource = normalizeClassifier(reply.classificationModel)

  return {
    id: reply.id,
    lead: buildLeadName({ firstName: leadFirstName, lastName: leadLastName, email: reply.leadEmail }),
    leadEmail: reply.leadEmail,
    company: leadCompany,
    campaign: campaignName,
    disposition: dispositionLabel,
    snippet: safeSnippet,
    receivedAt: reply.receivedAt.toISOString(),
    summary: reply.summary ?? extractedSummary?.summary ?? null,
    fullReply,
    subject: reply.subject ?? null,
    confidence: reply.classificationConfidence ?? null,
    classificationModel: reply.classificationModel ?? null,
    classificationSource,
    gmailMessageId: reply.gmailMessageId ?? null,
    gmailThreadId: reply.gmailThreadId ?? null,
  }
}

async function classifyIfNeeded(reply: RawEmailReply): Promise<void> {
  const plainBody = ensurePlainBody(reply)
  if (!plainBody) {
    return
  }

  const needsClassification =
    reply.disposition === ReplyDisposition.NO_RESPONSE || !reply.summary || reply.summary.trim().length === 0

  if (!needsClassification) {
    return
  }

  const classification = await classifyReplyContent({
    subject: reply.subject,
    body: plainBody,
    snippet: reply.snippet ?? undefined,
  })

  if (!classification) {
    return
  }

  const fallbackSummary = createExtractedSummary(plainBody)
  const summary = classification.summary || fallbackSummary.summary
  const snippet = classification.snippet ?? reply.snippet ?? fallbackSummary.snippet

  await prisma.emailReply.update({
    where: { id: reply.id },
    data: {
      disposition: classification.disposition,
      summary,
      classificationModel: classification.model,
      classificationConfidence: classification.confidence,
      classifiedAt: new Date(),
      snippet,
      bodyPlain: reply.bodyPlain ?? plainBody,
    },
  })

  reply.disposition = classification.disposition
  reply.summary = summary
  reply.classificationModel = classification.model
  reply.classificationConfidence = classification.confidence
  reply.classifiedAt = new Date()
  reply.snippet = snippet
  reply.bodyPlain = reply.bodyPlain ?? plainBody
}

function getHeaderValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string | null {
  if (!headers?.length) {
    return null
  }
  const match = headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())
  return match?.value ?? null
}

function extractEmailAddress(value: string | null): string | null {
  if (!value) return null
  const emailMatch = value.match(/<([^>]+)>/)
  const candidate = (emailMatch ? emailMatch[1] : value).trim()
  if (!candidate || !candidate.includes("@")) {
    return null
  }
  return candidate
}

function decodePartBody(body: gmail_v1.Schema$MessagePartBody | null | undefined): string | null {
  if (!body?.data) {
    return null
  }
  try {
    const normalized = body.data.replace(/-/g, "+").replace(/_/g, "/")
    return Buffer.from(normalized, "base64").toString("utf8")
  } catch (error) {
    console.error("Failed to decode Gmail message body", error)
    return null
  }
}

function extractMessageBodies(payload: gmail_v1.Schema$MessagePart | undefined | null): { plain: string | null; html: string | null } {
  if (!payload) {
    return { plain: null, html: null }
  }

  const result: { plain: string | null; html: string | null } = { plain: null, html: null }
  const stack: gmail_v1.Schema$MessagePart[] = [payload]

  while (stack.length > 0) {
    const part = stack.pop()
    if (!part) continue

    if (part.parts?.length) {
      stack.push(...part.parts)
    }

    if (!part.mimeType || !part.body) {
      continue
    }

    if (!result.plain && part.mimeType.startsWith("text/plain")) {
      result.plain = decodePartBody(part.body)
    } else if (!result.html && part.mimeType.startsWith("text/html")) {
      result.html = decodePartBody(part.body)
    }

    if (result.plain && result.html) {
      break
    }
  }

  if (!result.plain && payload.mimeType?.startsWith("text/plain")) {
    result.plain = decodePartBody(payload.body)
  }
  if (!result.html && payload.mimeType?.startsWith("text/html")) {
    result.html = decodePartBody(payload.body)
  }

  return result
}

function parseInternalDate(internalDate: string | null | undefined): Date {
  if (!internalDate) {
    return new Date()
  }
  const timestamp = Number(internalDate)
  if (Number.isFinite(timestamp)) {
    return new Date(timestamp)
  }
  return new Date()
}

async function syncRepliesForUser(userId: string): Promise<void> {
  const gmailAccount = await prisma.gmailAccount.findUnique({ where: { userId } })
  if (!gmailAccount) {
    return
  }

  let refreshedAccount
  try {
    refreshedAccount = await ensureFreshGmailToken(gmailAccount)
  } catch (error) {
    console.error("Failed to refresh Gmail token for reply sync", error)
    return
  }

  let authClient
  try {
    authClient = await createAuthorizedGmailClient(refreshedAccount.accessToken, refreshedAccount.refreshToken)
  } catch (error) {
    console.error("Failed to create Gmail client for reply sync", error)
    return
  }

  const gmail = google.gmail({ version: "v1", auth: authClient })
  let messageMetas: gmail_v1.Schema$Message[] = []

  const queryParts = [
    "in:inbox",
    `newer_than:${REPLY_SYNC_LOOKBACK_DAYS}d`,
    "-from:me",
    `-from:${refreshedAccount.emailAddress}`,
    "-category:social",
    "-category:promotions",
  ]

  try {
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      q: queryParts.join(" "),
      labelIds: ["INBOX"],
      maxResults: REPLY_SYNC_MAX_RESULTS,
    })
    messageMetas = listResponse.data.messages ?? []
  } catch (error) {
    console.error("Failed to list Gmail messages during reply sync", error)
    return
  }

  if (messageMetas.length === 0) {
    return
  }

  const messageIds = messageMetas.map((meta) => meta.id).filter((id): id is string => Boolean(id))
  if (messageIds.length === 0) {
    return
  }

  const existingReplies = await prisma.emailReply.findMany({
    where: {
      userId,
      gmailMessageId: { in: messageIds },
    },
    select: {
      gmailMessageId: true,
    },
  })
  const existingIds = new Set(existingReplies.map((reply) => reply.gmailMessageId).filter((id): id is string => Boolean(id)))
  const pendingIds = messageIds.filter((id) => !existingIds.has(id))

  if (pendingIds.length === 0) {
    return
  }

  const detailedMessages: gmail_v1.Schema$Message[] = []
  for (let i = 0; i < pendingIds.length; i += REPLY_SYNC_FETCH_BATCH) {
    const chunk = pendingIds.slice(i, i + REPLY_SYNC_FETCH_BATCH)
    const chunkMessages = await Promise.all(
      chunk.map(async (id) => {
        try {
          const response = await gmail.users.messages.get({
            userId: "me",
            id,
            format: "full",
          })
          return response.data
        } catch (error) {
          console.error(`Failed to fetch Gmail message ${id}`, error)
          return null
        }
      }),
    )
    for (const message of chunkMessages) {
      if (message) {
        detailedMessages.push(message)
      }
    }
  }

  if (detailedMessages.length === 0) {
    return
  }

  const emailTuples = detailedMessages
    .map((message) => {
      const email = extractEmailAddress(getHeaderValue(message.payload?.headers, "From"))
      if (!email) return null
      const trimmed = email.trim()
      if (!trimmed) return null
      return {
        original: trimmed,
        normalized: trimmed.toLowerCase(),
      }
    })
    .filter((tuple): tuple is { original: string; normalized: string } => Boolean(tuple))

  if (emailTuples.length === 0) {
    return
  }

  const queryEmails = Array.from(new Set(emailTuples.flatMap((tuple) => [tuple.original, tuple.normalized])))

  const leads = await prisma.lead.findMany({
    where: {
      userId,
      email: { in: queryEmails },
    },
    select: {
      id: true,
      email: true,
      campaignId: true,
    },
  })
  const leadMap = new Map(leads.map((lead) => [lead.email.toLowerCase(), lead]))

  const sendJobs = await prisma.emailSendJob.findMany({
    where: {
      userId,
      leadEmail: { in: queryEmails },
      status: "SENT",
    },
    orderBy: {
      sentAt: "desc",
    },
    select: {
      id: true,
      leadEmail: true,
      campaignId: true,
    },
  })

  const jobMap = new Map<string, (typeof sendJobs)[number]>()
  for (const job of sendJobs) {
    const key = job.leadEmail.toLowerCase()
    if (!jobMap.has(key)) {
      jobMap.set(key, job)
    }
  }

  const createPayloads: Prisma.EmailReplyCreateManyInput[] = []

  for (const message of detailedMessages) {
    const gmailMessageId = message.id
    if (!gmailMessageId || existingIds.has(gmailMessageId)) {
      continue
    }

    const fromEmail = extractEmailAddress(getHeaderValue(message.payload?.headers, "From"))
    if (!fromEmail) {
      continue
    }

    const normalizedEmail = fromEmail.toLowerCase()
    const associatedLead = leadMap.get(normalizedEmail) ?? null
    const associatedJob = jobMap.get(normalizedEmail) ?? null

    if (!associatedLead && !associatedJob) {
      continue
    }

    const subject = getHeaderValue(message.payload?.headers, "Subject")
    const bodies = extractMessageBodies(message.payload)
    const receivedAt = parseInternalDate(message.internalDate)

    createPayloads.push({
      userId,
      leadEmail: fromEmail,
      subject: subject ?? null,
      snippet: message.snippet ?? bodies.plain ?? bodies.html ?? null,
      bodyPlain: bodies.plain,
      bodyHtml: bodies.html,
      receivedAt,
      gmailMessageId,
      gmailThreadId: message.threadId ?? null,
      leadId: associatedLead?.id ?? null,
      campaignId: associatedLead?.campaignId ?? associatedJob?.campaignId ?? null,
      emailSendJobId: associatedJob?.id ?? null,
    })
  }

  if (createPayloads.length === 0) {
    return
  }

  try {
    await prisma.emailReply.createMany({
      data: createPayloads,
      skipDuplicates: true,
    })
  } catch (error) {
    console.error("Failed to persist Gmail replies", error)
  }
}

export async function fetchRepliesForUser(userId: string): Promise<ReplyRecord[]> {
  // Kick off sync in the background so the page is not blocked by Gmail/network latency.
  syncRepliesForUser(userId).catch((error) => {
    console.error("Failed to sync Gmail replies", error)
  })

  const replies = await prisma.emailReply.findMany({
    where: { userId },
    select: {
      id: true,
      leadEmail: true,
      subject: true,
      snippet: true,
      bodyPlain: true,
      bodyHtml: true,
      receivedAt: true,
      gmailMessageId: true,
      gmailThreadId: true,
      summary: true,
      disposition: true,
      classificationModel: true,
      classificationConfidence: true,
      emailSendJob: {
        select: {
          leadFirstName: true,
          leadLastName: true,
          leadCompany: true,
          manualCampaignName: true,
          campaign: {
            select: {
              name: true,
            },
          },
        },
      },
      lead: {
        select: {
          firstName: true,
          lastName: true,
          company: true,
        },
      },
      campaign: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      receivedAt: "desc",
    },
    take: 120,
  })

  // Fire-and-forget classification to avoid blocking the page render.
  void Promise.allSettled(replies.map((reply) => classifyIfNeeded(reply as RawEmailReply))).catch((error) => {
    console.error("Failed to classify replies in background", error)
  })

  return replies.map((reply) => mapToReplyRecord(reply as RawEmailReply))
}

export function triggerReplySync(userId: string): void {
  void syncRepliesForUser(userId).catch((error) => {
    console.error("Failed to trigger reply sync", error)
  })
}

export function formatReplyTimestamp(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export type { ReplyRecord } from "./types"

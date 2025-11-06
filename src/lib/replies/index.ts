import { Prisma, ReplyDisposition } from "@prisma/client"

import { prisma } from "@/lib/prisma"

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

export async function fetchRepliesForUser(userId: string): Promise<ReplyRecord[]> {
  const replies = await prisma.emailReply.findMany({
    where: { userId },
    include: {
      emailSendJob: {
        include: {
          campaign: true,
        },
      },
      lead: true,
      campaign: true,
    },
    orderBy: {
      receivedAt: "desc",
    },
    take: 200,
  })

  for (const reply of replies) {
    await classifyIfNeeded(reply)
  }

  return replies.map(mapToReplyRecord)
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

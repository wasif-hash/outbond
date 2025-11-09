import OpenAI from "openai"
import { z } from "zod"

import { ReplyDisposition } from "@prisma/client"

const CLASSIFIABLE_DISPOSITIONS = ["POSITIVE", "NEUTRAL", "NOT_INTERESTED", "UNSUB", "BOUNCED"] as const

const classificationSchema = z.object({
  disposition: z.enum(CLASSIFIABLE_DISPOSITIONS),
  summary: z.string().min(1).max(600),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().min(1).max(1200).optional(),
  snippet: z.string().min(1).max(280).optional(),
})

export type ReplyClassification = {
  disposition: ReplyDisposition
  summary: string
  confidence: number | null
  reasoning: string | null
  snippet: string | null
  model: string | null
  source: "openai" | "heuristic"
}

export type ReplyClassificationInput = {
  subject?: string | null
  body: string
  snippet?: string | null
}

const OPENAI_MODEL = process.env.OPENAI_REPLIES_MODEL ?? "gpt-4o-mini"

let openAIClient: OpenAI | null = null

function getOpenAIClient(): OpenAI | null {
  if (openAIClient) {
    return openAIClient
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return null
  }

  openAIClient = new OpenAI({ apiKey })
  return openAIClient
}

function toPrismaDisposition(value: (typeof CLASSIFIABLE_DISPOSITIONS)[number]): ReplyDisposition {
  switch (value) {
    case "POSITIVE":
      return ReplyDisposition.POSITIVE
    case "NEUTRAL":
      return ReplyDisposition.NEUTRAL
    case "NOT_INTERESTED":
      return ReplyDisposition.NOT_INTERESTED
    case "UNSUB":
      return ReplyDisposition.UNSUB
    case "BOUNCED":
      return ReplyDisposition.BOUNCED
    default:
      return ReplyDisposition.NEUTRAL
  }
}

type ParsedClassification = z.infer<typeof classificationSchema>

function extractJsonCandidate(raw: string): unknown | null {
  try {
    return JSON.parse(raw)
  } catch {
    // fallthrough
  }

  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) {
    return null
  }

  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

function toSummary(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim()
  if (!compact) {
    return "The contact responded, but no readable content was detected."
  }

  if (compact.length <= 320) {
    return compact
  }

  return `${compact.slice(0, 317)}...`
}

function toSnippet(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim()
  if (compact.length <= 180) {
    return compact
  }
  return `${compact.slice(0, 177)}...`
}

function classifyHeuristically(input: ReplyClassificationInput): ReplyClassification {
  const subject = input.subject?.toLowerCase() ?? ""
  const body = input.body.toLowerCase()
  const combined = `${subject}\n${body}`

  const unsubKeywords = ["unsubscribe", "remove me", "opt out", "opt-out", "stop emailing", "take me off", "no longer wish"]
  const bounceKeywords = ["delivery incomplete", "mail delivery", "undeliverable", "mailbox unavailable", "address not found", "bounced", "mailer-daemon"]
  const negativeKeywords = ["not interested", "no interest", "no thanks", "pass for now", "not a fit", "not at this time", "not right now", "not relevant"]
  const positiveKeywords = ["sounds good", "let's talk", "lets talk", "schedule a call", "set up a call", "interested", "let's connect", "follow up", "speak further", "chat further"]

  const snippet = input.snippet ?? toSnippet(input.body)
  const summary = toSummary(input.body)

  if (bounceKeywords.some((keyword) => combined.includes(keyword))) {
    return {
      disposition: ReplyDisposition.BOUNCED,
      summary,
      confidence: 0.7,
      reasoning: null,
      snippet,
      model: "heuristic/v1",
      source: "heuristic",
    }
  }

  if (unsubKeywords.some((keyword) => combined.includes(keyword))) {
    return {
      disposition: ReplyDisposition.UNSUB,
      summary,
      confidence: 0.75,
      reasoning: null,
      snippet,
      model: "heuristic/v1",
      source: "heuristic",
    }
  }

  if (negativeKeywords.some((keyword) => combined.includes(keyword))) {
    return {
      disposition: ReplyDisposition.NOT_INTERESTED,
      summary,
      confidence: 0.6,
      reasoning: null,
      snippet,
      model: "heuristic/v1",
      source: "heuristic",
    }
  }

  if (positiveKeywords.some((keyword) => combined.includes(keyword))) {
    return {
      disposition: ReplyDisposition.POSITIVE,
      summary,
      confidence: 0.65,
      reasoning: null,
      snippet,
      model: "heuristic/v1",
      source: "heuristic",
    }
  }

  return {
    disposition: ReplyDisposition.NO_RESPONSE,
    summary,
    confidence: 0.25,
    reasoning: null,
    snippet,
    model: "heuristic/v1",
    source: "heuristic",
  }
}

async function classifyWithOpenAI(input: ReplyClassificationInput): Promise<ReplyClassification | null> {
  const client = getOpenAIClient()
  if (!client) {
    return null
  }

  const bodyForPrompt = input.body.length > 4000 ? `${input.body.slice(0, 4000)}...` : input.body
  const messages = [
    {
      role: "system" as const,
      content:
        "You are an assistant that classifies inbound replies to outbound sales emails. Always respond with a valid JSON object that matches the schema. Never include markdown or surrounding text.",
    },
    {
      role: "user" as const,
      content: [
        `Classify the following reply.\n\nAllowed dispositions:\n- POSITIVE: The lead shows clear interest or wants to talk.\n- NEUTRAL: The lead is unclear, asks for more info, or auto replies.\n- NOT_INTERESTED: The lead declines or is not a fit.\n- UNSUB: The lead wants to unsubscribe or stop receiving emails.\n- BOUNCED: The message indicates a delivery failure or auto bounce.\n\nReturn JSON with keys: disposition, summary, confidence, reasoning, snippet.\n\nSubject: ${input.subject ?? "(no subject)"}\nReply:\n\"\"\"\n${bodyForPrompt}\n\"\"\"`,
      ],
    },
  ]

  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0,
      messages,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return null
    }

    const candidate = extractJsonCandidate(content)
    if (!candidate) {
      return null
    }

    const parsed = classificationSchema.safeParse(candidate)
    if (!parsed.success) {
      return null
    }

    const result: ParsedClassification = parsed.data
    const snippet = result.snippet ?? (input.snippet ?? toSnippet(input.body))

    return {
      disposition: toPrismaDisposition(result.disposition),
      summary: result.summary,
      confidence: result.confidence ?? null,
      reasoning: result.reasoning ?? null,
      snippet,
      model: `openai:${OPENAI_MODEL}`,
      source: "openai",
    }
  } catch (error) {
    console.error("Failed to classify reply with OpenAI", error)
    return null
  }
}

export async function classifyReplyContent(input: ReplyClassificationInput): Promise<ReplyClassification | null> {
  if (!input.body.trim()) {
    return null
  }

  const openAIResult = await classifyWithOpenAI(input)
  if (openAIResult) {
    return {
      ...openAIResult,
      snippet: openAIResult.snippet ?? input.snippet ?? toSnippet(input.body),
    }
  }

  const heuristicResult = classifyHeuristically(input)
  return {
    ...heuristicResult,
    snippet: heuristicResult.snippet ?? input.snippet ?? toSnippet(input.body),
  }
}

export function createExtractedSummary(body: string): { summary: string; snippet: string } {
  return {
    summary: toSummary(body),
    snippet: toSnippet(body),
  }
}

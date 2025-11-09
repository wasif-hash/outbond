export type ReplyDispositionLabel = "no response" | "positive" | "neutral" | "not interested" | "unsub" | "bounced"

export type ReplyRecord = {
  id: string
  lead: string
  leadEmail: string
  company: string | null
  campaign: string | null
  disposition: ReplyDispositionLabel
  snippet: string
  receivedAt: string
  summary: string | null
  fullReply: string
  subject: string | null
  confidence: number | null
  classificationModel: string | null
  classificationSource: "openai" | "heuristic" | null
  gmailMessageId: string | null
  gmailThreadId: string | null
}

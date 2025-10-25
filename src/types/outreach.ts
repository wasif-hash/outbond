export type OutreachMode = "single" | "bulk"

export type SheetLead = {
  rowIndex: number
  email: string
  firstName?: string
  lastName?: string
  company?: string
  summary?: string
  role?: string
  sourceRowRef?: string
}

export type DraftStatus = "pending" | "queued" | "sent" | "failed"

export type DraftRecord = {
  subject: string
  bodyHtml: string
  bodyText: string
  status: DraftStatus
  error?: string
}

export type ManualOutreachSource = "google-sheet" | "file-upload"

export type OutreachedJob = {
  id: string
  leadEmail: string
  leadFirstName?: string | null
  leadLastName?: string | null
  leadCompany?: string | null
  leadSummary?: string | null
  subject: string
  bodyHtml: string
  bodyText?: string | null
  status: string
  sheetRowRef?: string | null
  sentAt?: string | null
  createdAt: string
  manualCampaignId?: string | null
  manualCampaignName?: string | null
  manualCampaignSource?: ManualOutreachSource | null
}

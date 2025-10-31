import type {
  DraftRecord,
  ManualOutreachSource,
  OutreachedJob,
  OutreachMode,
  SheetLead,
} from "@/types/outreach"

export type ManualCampaignGroup = {
  id: string
  name: string
  source: ManualOutreachSource | null
  sentCount: number
  totalCount: number
  lastSentAt: string | null
  jobs: OutreachedJob[]
}

export type WizardStep = 1 | 2 | 3

export type OutreachSourceType = "google-sheet" | "file-upload"

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  status?: "loading" | "error" | "success"
}

export type PersistedWorkflowState = {
  campaignName: string
  manualCampaignId: string | null
  sourceType: OutreachSourceType | null
  currentStep: WizardStep
  selectedSheetId: string
  sheetRange: string
  leads: SheetLead[]
  promptInput: string
  chatMessages: ChatMessage[]
  drafts: Record<string, DraftRecord>
  sendingMode: OutreachMode
  uploadedFileMeta: { name: string; importedAt: number; rowCount: number } | null
  lastUpdated: number
}

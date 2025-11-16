import type {
  DraftRecord,
  ManualOutreachSource,
  OutreachMode,
  SheetLead,
} from "@/types/outreach"

export type OutreachSourceType = ManualOutreachSource

export type WizardStep = 1 | 2 | 3

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

export type ManualCampaignDraftStatus = "draft" | "queued" | "sent"

export type ManualCampaignDraft = {
  id: string
  name: string
  sourceType: ManualOutreachSource | null
  status: ManualCampaignDraftStatus
  createdAt: string
  updatedAt: string
  workflowState: PersistedWorkflowState
}

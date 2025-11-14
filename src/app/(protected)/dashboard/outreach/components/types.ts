import type { ManualOutreachSource, OutreachedJob } from "@/types/outreach"
export type {
  ChatMessage,
  OutreachSourceType,
  PersistedWorkflowState,
  WizardStep,
} from "@/types/outreach-workflow"

export type ManualCampaignGroup = {
  id: string
  name: string
  source: ManualOutreachSource | null
  sentCount: number
  totalCount: number
  lastSentAt: string | null
  jobs: OutreachedJob[]
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Eye, Play, RefreshCw, Trash2 } from "lucide-react"

import { FastSpinner } from "./FastSpinner"
import type { ManualCampaignGroup } from "./types"
import type { OutreachedJob } from "@/types/outreach"
import type { ManualCampaignDraft } from "@/types/outreach-workflow"

type OutreachHistoryProps = {
  jobsLoading: boolean
  draftsLoading: boolean
  draftCampaigns: ManualCampaignDraft[]
  deletingDraftId: string | null
  manualCampaigns: ManualCampaignGroup[]
  filteredCampaigns: ManualCampaignGroup[]
  onResumeDraft: (draft: ManualCampaignDraft) => void
  onDeleteDraft: (draftId: string) => void
  onRefresh: () => void
  onExportAll: () => void
  onExportCampaign: (jobs: OutreachedJob[], options?: { fileLabel?: string }) => void
  onNavigateCampaign: (campaignId: string) => void
}

export function OutreachHistory({
  jobsLoading,
  draftsLoading,
  draftCampaigns,
  deletingDraftId,
  manualCampaigns,
  filteredCampaigns,
  onResumeDraft,
  onDeleteDraft,
  onRefresh,
  onExportAll,
  onExportCampaign,
  onNavigateCampaign,
}: OutreachHistoryProps) {
  const totalExportableJobs = manualCampaigns.reduce((sum, campaign) => sum + campaign.jobs.length, 0)

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg font-mono">Outreach history</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review every outreach campaign launched from this dashboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onRefresh} disabled={jobsLoading}>
            {jobsLoading ? <FastSpinner size="sm" className="mr-2" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {jobsLoading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onExportAll}
            disabled={jobsLoading || totalExportableJobs === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <DraftCampaigns
          draftCampaigns={draftCampaigns}
          draftsLoading={draftsLoading}
          deletingDraftId={deletingDraftId}
          onResumeDraft={onResumeDraft}
          onDeleteDraft={onDeleteDraft}
        />

        <CompletedCampaigns
          jobsLoading={jobsLoading}
          manualCampaigns={manualCampaigns}
          filteredCampaigns={filteredCampaigns}
          onNavigateCampaign={onNavigateCampaign}
          onExportCampaign={onExportCampaign}
        />
    </CardContent>
  </Card>
)
}

function DraftCampaigns({
  draftsLoading,
  deletingDraftId,
  onResumeDraft,
  onDeleteDraft,
  draftCampaigns,
}: Pick<OutreachHistoryProps, "draftsLoading" | "deletingDraftId" | "onResumeDraft" | "onDeleteDraft"> & {
  draftCampaigns: ManualCampaignDraft[]
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Draft campaigns</h3>
          <p className="text-xs text-muted-foreground">
            Save progress from the outreach wizard and pick up where you left off.
          </p>
        </div>
        <Badge variant="outline" className="font-mono uppercase">
          {draftCampaigns.length} saved
        </Badge>
      </div>
      {draftsLoading ? (
        <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
          <FastSpinner />
          Loading drafts…
        </div>
      ) : draftCampaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          No drafts yet. Use “Save draft campaign” in Step 3 to store your prompt, leads, and AI drafts.
        </div>
      ) : (
        <div className="space-y-3">
          {draftCampaigns.map((draft) => {
            const leadCount = Array.isArray(draft.workflowState?.leads) ? draft.workflowState.leads.length : 0
            const promptPreview = draft.workflowState?.promptInput?.trim()
            return (
              <div
                key={draft.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{draft.name}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {draft.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {leadCount} lead{leadCount === 1 ? "" : "s"} saved · Updated {new Date(draft.updatedAt).toLocaleString()}
                  </p>
                  {promptPreview ? (
                    <p className="text-xs text-muted-foreground line-clamp-1">Prompt: {promptPreview}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" onClick={() => onResumeDraft(draft)}>
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeleteDraft(draft.id)}
                    disabled={deletingDraftId === draft.id}
                  >
                    {deletingDraftId === draft.id ? (
                      <FastSpinner size="sm" className="mr-2" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function CompletedCampaigns({
  jobsLoading,
  manualCampaigns,
  filteredCampaigns,
  onNavigateCampaign,
  onExportCampaign,
}: Pick<OutreachHistoryProps, "jobsLoading" | "manualCampaigns" | "filteredCampaigns" | "onNavigateCampaign" | "onExportCampaign">) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Completed outreach campaigns</h3>
          <p className="text-xs text-muted-foreground">
            Click any campaign to review the leads that were emailed. Campaign summaries include only outreach launched from this page.
          </p>
        </div>
        <Badge variant="outline" className="font-mono uppercase">
          {manualCampaigns.length} total
        </Badge>
      </div>
      {jobsLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <FastSpinner />
          Loading outreach history…
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          {manualCampaigns.length === 0
            ? "No outreach campaigns have been sent yet. Complete Step 3 above to start building your history."
            : "No campaigns match your search."}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCampaigns.map((campaign) => (
            <div
              key={campaign.id}
              onClick={() => onNavigateCampaign(campaign.id)}
              className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{campaign.name}</span>
                  <Badge variant="outline" className="font-mono text-xs uppercase">
                    {campaign.sentCount}/{campaign.totalCount} sent
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {campaign.source === "google-sheet" ? "Google Sheet" : "File upload"} • {campaign.lastSentAt ? new Date(campaign.lastSentAt).toLocaleString() : "Not sent yet"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation()
                    onNavigateCampaign(campaign.id)
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View metrics
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation()
                    const normalizedLabel = (campaign.name ?? "outreach-campaign")
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                    onExportCampaign(campaign.jobs, {
                      fileLabel: normalizedLabel,
                    })
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Eye, Play, RefreshCw, Trash2 } from "lucide-react"

import { FastSpinner } from "./FastSpinner"
import type { ManualCampaignGroup } from "./types"
import type { OutreachedJob } from "@/types/outreach"
import type { ManualCampaignDraft } from "@/types/outreach-workflow"
import { cn } from "@/lib/utils"
import { jobStatusBadgeProps } from "@/lib/leads/outreach"

type OutreachHistoryProps = {
  jobsLoading: boolean
  draftsLoading: boolean
  draftCampaigns: ManualCampaignDraft[]
  deletingDraftId: string | null
  manualCampaigns: ManualCampaignGroup[]
  filteredCampaigns: ManualCampaignGroup[]
  legacyJobs: OutreachedJob[]
  filteredLegacyJobs: OutreachedJob[]
  onResumeDraft: (draft: ManualCampaignDraft) => void
  onDeleteDraft: (draftId: string) => void
  onRefresh: () => void
  onExportAll: () => void
  onExportCampaign: (jobs: OutreachedJob[], options?: { fileLabel?: string }) => void
  onSelectCampaign: (campaign: ManualCampaignGroup) => void
  onPreviewLegacyJob: (job: OutreachedJob) => void
}

export function OutreachHistory({
  jobsLoading,
  draftsLoading,
  draftCampaigns,
  deletingDraftId,
  manualCampaigns,
  filteredCampaigns,
  legacyJobs,
  filteredLegacyJobs,
  onResumeDraft,
  onDeleteDraft,
  onRefresh,
  onExportAll,
  onExportCampaign,
  onSelectCampaign,
  onPreviewLegacyJob,
}: OutreachHistoryProps) {
  const totalExportableJobs = manualCampaigns.reduce((sum, campaign) => sum + campaign.jobs.length, 0) + legacyJobs.length

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg font-mono">Outreach history</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review sent campaigns and legacy emails queued from this dashboard.
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
          onSelectCampaign={onSelectCampaign}
          onExportCampaign={onExportCampaign}
        />

        <LegacyEmails
          jobsLoading={jobsLoading}
          legacyJobs={legacyJobs}
          filteredLegacyJobs={filteredLegacyJobs}
          onPreviewLegacyJob={onPreviewLegacyJob}
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
  onSelectCampaign,
  onExportCampaign,
}: Pick<OutreachHistoryProps, "jobsLoading" | "manualCampaigns" | "filteredCampaigns" | "onSelectCampaign" | "onExportCampaign">) {
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
              className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
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
                <Button size="sm" variant="outline" onClick={() => onSelectCampaign(campaign)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View leads
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
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

function LegacyEmails({
  jobsLoading,
  legacyJobs,
  filteredLegacyJobs,
  onPreviewLegacyJob,
}: Pick<OutreachHistoryProps, "jobsLoading" | "legacyJobs" | "filteredLegacyJobs" | "onPreviewLegacyJob">) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Legacy emails</h3>
          <p className="text-xs text-muted-foreground">
            Emails without a campaign tag appear here. You can still review and export them.
          </p>
        </div>
        <Badge variant="outline" className="font-mono uppercase">
          {filteredLegacyJobs.length}
        </Badge>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-left">
              <th className="px-4 py-2 font-mono font-semibold">Recipient</th>
              <th className="px-4 py-2 font-mono font-semibold">Subject</th>
              <th className="px-4 py-2 font-mono font-semibold">Status</th>
              <th className="px-4 py-2 font-mono font-semibold">Sent</th>
              <th className="px-4 py-2 font-mono font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobsLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Loading outreached emails…
                </td>
              </tr>
            ) : filteredLegacyJobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  {legacyJobs.length === 0 ? "No emails have been sent yet." : "No legacy emails match your search."}
                </td>
              </tr>
            ) : (
              filteredLegacyJobs.map((job) => (
                <tr key={job.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <div className="font-medium">
                      {job.leadFirstName || job.leadLastName
                        ? `${job.leadFirstName ?? ""} ${job.leadLastName ?? ""}`.trim()
                        : job.leadEmail}
                    </div>
                    <div className="text-xs text-muted-foreground">{job.leadEmail}</div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground line-clamp-1">{job.subject}</td>
                <td className="px-4 py-2">
                  {(() => {
                    const { label, className } = jobStatusBadgeProps(job.status)
                    return (
                      <Badge
                        variant="outline"
                        className={cn(
                          "min-w-[88px] justify-center uppercase tracking-wide",
                          className,
                        )}
                      >
                        {label}
                      </Badge>
                    )
                  })()}
                </td>
                  <td className="px-4 py-2 text-xs whitespace-nowrap text-muted-foreground">
                    {job.sentAt ? new Date(job.sentAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Button size="sm" variant="outline" onClick={() => onPreviewLegacyJob(job)}>
                      <Eye className="mr-2 h-4 w-4" /> View
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

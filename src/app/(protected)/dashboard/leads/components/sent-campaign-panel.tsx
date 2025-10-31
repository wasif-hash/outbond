"use client"

import type { ManualCampaignGroup } from "./types"
import { OverlayPanel } from "./overlay-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, Eye } from "lucide-react"
import { jobStatusVariant } from "@/lib/leads/outreach"
import type { OutreachedJob } from "@/types/outreach"

type SentCampaignPanelProps = {
  open: boolean
  campaign: ManualCampaignGroup | null
  onClose: () => void
  onExport: (jobs: OutreachedJob[], options?: { fileLabel?: string }) => void
  onPreviewJob: (job: OutreachedJob) => void
}

export function SentCampaignPanel({
  open,
  campaign,
  onClose,
  onExport,
  onPreviewJob,
}: SentCampaignPanelProps) {
  return (
    <OverlayPanel
      open={open}
      onClose={onClose}
      contentClassName="max-w-[min(1000px,calc(100vw-2rem))]"
    >
      {campaign ? (
        <>
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold text-foreground">{campaign.name ?? "Outreach campaign"}</h2>
            <p className="text-sm text-muted-foreground">
              {campaign.sentCount}/{campaign.totalCount} emails sent ·{" "}
              {campaign.source === "google-sheet" ? "Google Sheet" : "File upload"}
            </p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Last activity {campaign.lastSentAt ? new Date(campaign.lastSentAt).toLocaleString() : "Not sent yet"}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const normalizedLabel = (campaign.name ?? "outreach-campaign")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                  onExport(campaign.jobs, {
                    fileLabel: normalizedLabel,
                  })
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
            <div className="overflow-auto rounded-lg border border-border">
              <table className="min-w-[720px] w-full text-sm">
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
                  {campaign.jobs.map((job) => (
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
                        <Badge variant={jobStatusVariant(job.status)}>
                          {job.status === "SENT" ? "COMPLETED" : job.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {job.sentAt ? new Date(job.sentAt).toLocaleString() : "Not sent"}
                      </td>
                      <td className="px-4 py-2">
                        <Button size="sm" variant="outline" onClick={() => onPreviewJob(job)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View email
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 py-6 text-sm text-muted-foreground">
          Select a campaign to review the outreach details.
        </div>
      )}
    </OverlayPanel>
  )
}

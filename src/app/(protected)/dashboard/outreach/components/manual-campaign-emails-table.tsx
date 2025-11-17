"use client"

import { useState } from "react"
import { Eye } from "lucide-react"

import type { OutreachedJob } from "@/types/outreach"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { jobStatusBadgeProps } from "@/lib/leads/outreach"
import { SentEmailPanel } from "./sent-email-panel"
import { htmlToPlainText } from "@/lib/email/format"

type ManualCampaignEmailsTableProps = {
  emails: OutreachedJob[]
}

export function ManualCampaignEmailsTable({ emails }: ManualCampaignEmailsTableProps) {
  const [previewJob, setPreviewJob] = useState<OutreachedJob | null>(null)

  if (emails.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        No emails have been generated for this campaign yet.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
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
            {emails.map((job) => (
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
                        className={cn("min-w-[88px] justify-center uppercase tracking-wide", className)}
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
                  <Button size="sm" variant="outline" onClick={() => setPreviewJob(job)}>
                    <Eye className="mr-2 h-4 w-4" /> View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SentEmailPanel
        open={Boolean(previewJob)}
        job={previewJob}
        onClose={() => setPreviewJob(null)}
        plainBodyRenderer={htmlToPlainText}
      />
    </>
  )
}

"use client"

import type { OutreachedJob } from "@/types/outreach"
import { OverlayPanel } from "./overlay-panel"

type SentEmailPanelProps = {
  open: boolean
  job: OutreachedJob | null
  onClose: () => void
  plainBodyRenderer: (html: string) => string
}

export function SentEmailPanel({ open, job, onClose, plainBodyRenderer }: SentEmailPanelProps) {
  return (
    <OverlayPanel open={open} onClose={onClose} contentClassName="max-w-3xl">
      {job ? (
        <>
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-semibold text-foreground">Sent email</h2>
            <p className="text-sm text-muted-foreground">
              Sent to <span className="font-medium text-foreground">{job.leadEmail}</span>
            </p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Subject</p>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">{job.subject}</div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Body</p>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {job.bodyText ? job.bodyText : plainBodyRenderer(job.bodyHtml)}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 py-6 text-sm text-muted-foreground">
          Select an email to preview.
        </div>
      )}
    </OverlayPanel>
  )
}


"use client"

import type { DraftRecord, SheetLead } from "@/types/outreach"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PencilLine } from "lucide-react"

import { statusVariant } from "@/lib/leads/outreach"

import { OverlayPanel } from "./overlay-panel"

type DraftPreviewPanelProps = {
  open: boolean
  lead: SheetLead | undefined
  draft: DraftRecord | null
  editing: boolean
  editedSubject: string
  editedBody: string
  onEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onClose: () => void
  onChangeSubject: (value: string) => void
  onChangeBody: (value: string) => void
  plainBodyRenderer: (draft: DraftRecord) => string
}

export function DraftPreviewPanel({
  open,
  lead,
  draft,
  editing,
  editedSubject,
  editedBody,
  onEdit,
  onCancelEdit,
  onSave,
  onClose,
  onChangeSubject,
  onChangeBody,
  plainBodyRenderer,
}: DraftPreviewPanelProps) {
  const renderBody = () => {
    if (!draft) return "No body content"
    if (draft.bodyText) return draft.bodyText
    if (draft.bodyHtml) return plainBodyRenderer(draft)
    return "No body content"
  }

  return (
    <OverlayPanel open={open} onClose={onClose} contentClassName="max-w-[min(960px,calc(100vw-2rem))]">
      {draft ? (
        <>
          <div className="border-b border-border px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Draft preview</h2>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {lead?.firstName || lead?.lastName
                      ? `${lead?.firstName ?? ""} ${lead?.lastName ?? ""}`.trim()
                      : lead?.email ?? ""}
                  </span>
                  <span className="font-mono text-xs text-foreground/80">{lead?.email ?? ""}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(draft.status)}>{draft.status.toUpperCase()}</Badge>
                {editing ? (
                  <>
                    <Button size="sm" variant="outline" onClick={onCancelEdit}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={onSave}>
                      Save draft
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={onEdit}>
                    <PencilLine className="mr-2 h-4 w-4" />
                    Edit draft
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Subject</p>
              {editing ? (
                <Input value={editedSubject} onChange={(event) => onChangeSubject(event.target.value)} />
              ) : (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">{draft.subject}</div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Body</p>
              {editing ? (
                <Textarea
                  value={editedBody}
                  onChange={(event) => onChangeBody(event.target.value)}
                  rows={16}
                  className="min-h-[240px]"
                />
              ) : (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                  {renderBody()}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 py-6 text-sm text-muted-foreground">
          Select a draft to preview.
        </div>
      )}
    </OverlayPanel>
  )
}


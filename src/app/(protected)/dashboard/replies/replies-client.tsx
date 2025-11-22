"use client"

import { useEffect, useMemo, useState } from "react"
import { MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { ReplyRecord } from "@/lib/replies/types"

type ReplyDisposition = ReplyRecord["disposition"]

type RepliesClientProps = {
  replies: ReplyRecord[]
}

const REPLIES_BADGE_EVENT = "outbond:replies:badge-update"
const REPLIES_UNREAD_KEY = "outbond.replies.unread"
const REPLIES_LAST_SEEN_KEY = "outbond.replies.last-seen"
const REPLIES_LATEST_TS_KEY = "outbond.replies.latest-timestamp"

const FILTER_DEFINITIONS: Array<{ label: string; value: "all" | ReplyDisposition }> = [
  { label: "All", value: "all" },
  { label: "No Response", value: "no response" },
  { label: "Positive", value: "positive" },
  { label: "Neutral", value: "neutral" },
  { label: "Not Interested", value: "not interested" },
  { label: "Unsub", value: "unsub" },
  { label: "Bounced", value: "bounced" },
]

const EMPTY_COUNTS: Record<ReplyDisposition, number> = {
  "no response": 0,
  positive: 0,
  neutral: 0,
  "not interested": 0,
  unsub: 0,
  bounced: 0,
}

const badgeVariant = (disposition: ReplyDisposition) => {
  switch (disposition) {
    case "positive":
      return "positive"
    case "neutral":
      return "neutral"
    case "not interested":
      return "negative"
    case "unsub":
      return "unsub"
    case "bounced":
      return "bounce"
    case "no response":
      return "secondary"
    default:
      return "secondary"
  }
}

const displayDisposition = (value: ReplyDisposition) => {
  if (value === "no response") {
    return "No Response"
  }
  if (value === "not interested") {
    return "Not Interested"
  }
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

const formatTimestamp = (iso: string) => timestampFormatter.format(new Date(iso))

const formatConfidence = (confidence: number | null) =>
  typeof confidence === "number" ? `${Math.round(confidence * 100)}%` : "—"

const summariseModel = (model: string | null) => {
  if (!model) return "—"
  if (model.includes(":")) {
    return model.split(":")[1]
  }
  return model
}

const summariseSource = (source: string | null) => {
  if (!source) return "—"
  return source.replace(/\b\w/g, (match) => match.toUpperCase())
}

const THREAD_BREAK_MARKERS = [
  /^on .+wrote:?$/i,
  /^from:\s*/i,
  /^sent:\s*/i,
  /^subject:\s*/i,
  /^-{2,}\s*original message\s*-{2,}$/i,
  /^begin forwarded message/i,
]

const extractLatestReplyText = (reply: ReplyRecord) => {
  const content = reply.fullReply?.trim() || reply.snippet || ""
  if (!content) return ""

  const lines = content.replace(/\r\n?/g, "\n").split("\n")
  const cleaned: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!cleaned.length && trimmed.length === 0) {
      continue
    }

    if (trimmed.startsWith(">")) {
      break
    }

    if (THREAD_BREAK_MARKERS.some((pattern) => pattern.test(trimmed))) {
      break
    }

    cleaned.push(line)
  }

  const joined = cleaned.join("\n").trim()
  return joined || content
}

const getReplyPreview = (reply: ReplyRecord) => {
  const base =
    extractLatestReplyText(reply).replace(/\s+/g, " ").trim() || reply.snippet || "No preview available."
  return base.trim()
}

export function RepliesClient({ replies }: RepliesClientProps) {
  const [selectedFilter, setSelectedFilter] = useState<"all" | ReplyDisposition>("all")
  const [selectedReply, setSelectedReply] = useState<ReplyRecord | null>(null)

  useEffect(() => {
    const newestTimestamp = replies.reduce((latest, reply) => {
      const received = Date.parse(reply.receivedAt)
      return Number.isFinite(received) ? Math.max(latest, received) : latest
    }, 0)

    const safeLatest = newestTimestamp || Date.now()
    localStorage.setItem(REPLIES_LAST_SEEN_KEY, String(safeLatest))
    localStorage.setItem(REPLIES_LATEST_TS_KEY, String(safeLatest))
    localStorage.setItem(REPLIES_UNREAD_KEY, "0")
    window.dispatchEvent(new CustomEvent(REPLIES_BADGE_EVENT, { detail: { count: 0 } }))
  }, [replies])

  const counts = useMemo(() => {
    return replies.reduce<Record<ReplyDisposition, number>>((acc, reply) => {
      acc[reply.disposition] += 1
      return acc
    }, { ...EMPTY_COUNTS })
  }, [replies])

  const filteredReplies = useMemo(() => {
    if (selectedFilter === "all") return replies
    return replies.filter((reply) => reply.disposition === selectedFilter)
  }, [replies, selectedFilter])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-mono font-bold text-foreground">Replies</h1>
        <p className="text-muted-text mt-1">
          Monitor inbound replies and review AI triage across your campaigns.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTER_DEFINITIONS.map((filter) => (
          <Button
            key={filter.value}
            variant={selectedFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedFilter(filter.value)}
            className={cn(
              "h-8 transition-colors",
              selectedFilter === filter.value ? "" : "text-muted-foreground"
            )}
          >
            {filter.label}
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
              {filter.value === "all" ? replies.length : counts[filter.value]}
            </Badge>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-mono">
            {selectedFilter === "all" ? "All Replies" : `${displayDisposition(selectedFilter)} Replies`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full table-fixed">
              <thead >
                <tr className="border-b border-border">
                  <th className="w-48 py-3 text-left font-mono text-sm font-bold ">Lead</th>
                  <th className="hidden py-3 text-left font-mono text-sm font-bold lg:table-cell">Company</th>
                  <th className="hidden py-3 text-left font-mono text-sm font-bold lg:table-cell">Campaign</th>
                  <th className="py-3 text-left font-mono text-sm font-bold">Disposition</th>
                  <th className="py-3 text-left font-mono text-sm font-bold">Reply</th>
                  <th className="py-3 text-left font-mono text-sm font-bold">Received</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filteredReplies.map((reply) => (
                  <tr
                    key={reply.id}
                    className="cursor-pointer border-b border-border transition-colors hover:bg-muted/40"
                    onClick={() => setSelectedReply(reply)}
                  >
                    <td className="py-3 font-medium">{reply.lead}</td>
                    <td className="hidden py-3 text-muted-text lg:table-cell">{reply.company ?? "—"}</td>
                    <td className="hidden py-3 lg:table-cell">{reply.campaign ?? "—"}</td>
                    <td className="py-3">
                      <Badge variant={badgeVariant(reply.disposition)}>
                        {displayDisposition(reply.disposition)}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <p className="line-clamp-2 text-sm text-muted-foreground" title={getReplyPreview(reply)}>
                        {getReplyPreview(reply)}
                      </p>
                    </td>
                    <td className="py-3 font-mono text-sm text-muted-text">
                      {formatTimestamp(reply.receivedAt)}
                    </td>
                    <td className="py-3">
                      <MessageSquare className="h-4 w-4 text-muted-text" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredReplies.map((reply) => (
              <button
                key={reply.id}
                type="button"
                className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/60"
                onClick={() => setSelectedReply(reply)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">{reply.lead}</p>
                    <p className="text-xs text-muted-foreground">{reply.leadEmail}</p>
                  </div>
                  <Badge variant={badgeVariant(reply.disposition)}>
                    {displayDisposition(reply.disposition)}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground" title={getReplyPreview(reply)}>
                  {getReplyPreview(reply)}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{reply.campaign ?? "—"}</span>
                  <span className="font-mono">{formatTimestamp(reply.receivedAt)}</span>
                </div>
              </button>
            ))}
          </div>

          {filteredReplies.length === 0 && (
            <div className="py-12 text-center text-muted-text">
              No replies found for the selected filter.
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
      open={!!selectedReply}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedReply(null)
        }
      }}
    >
      <SheetContent className="w-full sm:max-w-[540px] px-4 sm:px-6">
        <SheetHeader>
          <SheetTitle className="font-mono">
            Reply from {selectedReply?.lead ?? "Lead"}
          </SheetTitle>
        </SheetHeader>

          {selectedReply && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-text font-medium">Email</div>
                  <div className="font-mono text-xs">{selectedReply.leadEmail}</div>
                </div>
                <div>
                  <div className="text-muted-text font-medium">Company</div>
                  <div>{selectedReply.company ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-text font-medium">Campaign</div>
                  <div>{selectedReply.campaign ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-text font-medium">Received</div>
                  <div className="font-mono text-xs">
                    {formatTimestamp(selectedReply.receivedAt)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-text font-medium">Disposition</div>
                  <Badge variant={badgeVariant(selectedReply.disposition)}>
                    {displayDisposition(selectedReply.disposition)}
                  </Badge>
                </div>
                <div>
                  <div className="text-muted-text font-medium">Confidence</div>
                  <div>{formatConfidence(selectedReply.confidence)}</div>
                </div>
                <div>
                  <div className="text-muted-text font-medium">Classifier</div>
                  <div>{summariseModel(selectedReply.classificationModel)}</div>
                </div>
                <div>
                  <div className="text-muted-text font-medium">Source</div>
                  <div>{summariseSource(selectedReply.classificationSource)}</div>
                </div>
              </div>

              {selectedReply.subject && (
                <div>
                  <div className="text-muted-text font-medium">Subject</div>
                  <div className="font-mono text-sm">{selectedReply.subject}</div>
                </div>
              )}

              <div>
                <h4 className="mb-3 font-mono font-bold">Full Reply</h4>
                <div className="rounded-lg border-l-4 border-cwt-plum bg-muted/40 p-4">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                    {extractLatestReplyText(selectedReply) || "No message content available."}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

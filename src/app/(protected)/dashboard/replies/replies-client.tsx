"use client"

import { useMemo, useState } from "react"
import { MessageSquare } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

type ReplyDisposition = "positive" | "neutral" | "not interested" | "unsub" | "bounced"

export type ReplyRecord = {
  id: number
  lead: string
  company: string
  campaign: string
  disposition: ReplyDisposition
  snippet: string
  timestamp: string
  fullReply: string
}

type RepliesClientProps = {
  replies: ReplyRecord[]
}

const FILTER_DEFINITIONS: Array<{ label: string; value: "all" | ReplyDisposition }> = [
  { label: "All", value: "all" },
  { label: "Positive", value: "positive" },
  { label: "Neutral", value: "neutral" },
  { label: "Not Interested", value: "not interested" },
  { label: "Unsub", value: "unsub" },
  { label: "Bounced", value: "bounced" },
]

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
    default:
      return "secondary"
  }
}

export function RepliesClient({ replies }: RepliesClientProps) {
  const [selectedFilter, setSelectedFilter] = useState<"all" | ReplyDisposition>("all")
  const [selectedReply, setSelectedReply] = useState<ReplyRecord | null>(null)

  const counts = useMemo(() => {
    return replies.reduce<Record<ReplyDisposition, number>>(
      (acc, reply) => {
        acc[reply.disposition] += 1
        return acc
      },
      {
        positive: 0,
        neutral: 0,
        "not interested": 0,
        unsub: 0,
        bounced: 0,
      },
    )
  }, [replies])

  const filteredReplies = useMemo(() => {
    if (selectedFilter === "all") return replies
    return replies.filter((reply) => reply.disposition === selectedFilter)
  }, [replies, selectedFilter])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-mono font-bold text-foreground">Replies</h1>
        <p className="text-muted-text mt-1">Monitor and categorise inbound email responses</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTER_DEFINITIONS.map((filter) => (
          <Button
            key={filter.value}
            variant={selectedFilter === filter.value ? "plum" : "outline"}
            size="sm"
            onClick={() => setSelectedFilter(filter.value)}
            className="h-8"
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
            {selectedFilter === "all" ? "All Replies" : `${selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1)} Replies`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 text-left font-mono text-sm font-bold">Lead</th>
                  <th className="py-3 text-left font-mono text-sm font-bold">Company</th>
                  <th className="py-3 text-left font-mono text-sm font-bold">Campaign</th>
                  <th className="py-3 text-left font-mono text-sm font-bold">Disposition</th>
                  <th className="py-3 text-left font-mono text-sm font-bold">Snippet</th>
                  <th className="py-3 text-left font-mono text-sm font-bold">Timestamp</th>
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
                    <td className="py-3 text-muted-text">{reply.company}</td>
                    <td className="py-3">{reply.campaign}</td>
                    <td className="py-3">
                      <Badge variant={badgeVariant(reply.disposition)}>{reply.disposition}</Badge>
                    </td>
                    <td className="py-3 max-w-xs truncate text-muted-text">{reply.snippet}</td>
                    <td className="py-3 font-mono text-sm text-muted-text">{reply.timestamp}</td>
                    <td className="py-3">
                      <MessageSquare className="h-4 w-4 text-muted-text" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredReplies.length === 0 && (
            <div className="py-12 text-center text-muted-text">No replies found for the selected filter.</div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedReply} onOpenChange={() => setSelectedReply(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="font-mono">Reply from {selectedReply?.lead}</SheetTitle>
          </SheetHeader>

          {selectedReply && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-text font-medium">Company</div>
                  <div>{selectedReply.company}</div>
                </div>
                <div>
                  <div className="text-muted-text font-medium">Campaign</div>
                  <div>{selectedReply.campaign}</div>
                </div>
                <div>
                  <div className="text-muted-text font-medium">Timestamp</div>
                  <div className="font-mono">{selectedReply.timestamp}</div>
                </div>
                <div>
                  <div className="text-muted-text font-medium">Disposition</div>
                  <Badge variant={badgeVariant(selectedReply.disposition)}>{selectedReply.disposition}</Badge>
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-mono font-bold">Full Reply</h4>
                <div className="rounded-lg border-l-4 border-cwt-plum bg-muted/40 p-4">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">{selectedReply.fullReply}</pre>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

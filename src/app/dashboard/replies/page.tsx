"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge" 
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { MessageSquare } from "lucide-react"

const replyFilters = [
  { label: "All", value: "all", count: 23 },
  { label: "Positive", value: "positive", count: 8 },
  { label: "Neutral", value: "neutral", count: 7 },
  { label: "Not Interested", value: "not interested", count: 5 },
  { label: "Unsub", value: "unsub", count: 2 },
  { label: "Bounced", value: "bounced", count: 1 },
]

const replies = [
  {
    id: 1,
    lead: "Marco Ruiz",
    company: "FiberNorth", 
    campaign: "Q3 Utility Outreach",
    disposition: "positive",
    snippet: "Looks good, can we talk Friday?",
    timestamp: "Aug 24, 10:21",
    fullReply: "Hi there,\n\nThanks for reaching out. Your solution looks interesting and could be a good fit for our Q4 infrastructure planning. Can we schedule a call for Friday afternoon to discuss further?\n\nBest regards,\nMarco"
  },
  {
    id: 2,
    lead: "Jane Doe", 
    company: "TelecomOne",
    campaign: "Telecom Decision Makers",
    disposition: "neutral",
    snippet: "Send details.",
    timestamp: "Aug 24, 09:55",
    fullReply: "Send me more details about pricing and implementation timeline."
  },
  {
    id: 3,
    lead: "Lena Chen",
    company: "EastHydro",
    campaign: "Energy Sector Pilots", 
    disposition: "unsub",
    snippet: "Remove me.",
    timestamp: "Aug 23, 16:10",
    fullReply: "Please remove me from your mailing list."
  },
]

export default function Replies() {
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [selectedReply, setSelectedReply] = useState<typeof replies[0] | null>(null)

  const filteredReplies = selectedFilter === "all" 
    ? replies 
    : replies.filter(reply => reply.disposition === selectedFilter)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-mono font-bold text-foreground">Replies</h1>
        <p className="text-muted-text mt-1">Monitor and categorize inbound email responses</p>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {replyFilters.map((filter) => (
          <Button
            key={filter.value}
            variant={selectedFilter === filter.value ? "plum" : "outline"}
            size="sm"
            onClick={() => setSelectedFilter(filter.value)}
            className="h-8"
          >
            {filter.label}
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
              {filter.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Replies Table */}
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
                  <th className="text-left py-3 font-mono font-bold text-sm">Lead</th>
                  <th className="text-left py-3 font-mono font-bold text-sm">Company</th>
                  <th className="text-left py-3 font-mono font-bold text-sm">Campaign</th>
                  <th className="text-left py-3 font-mono font-bold text-sm">Disposition</th>
                  <th className="text-left py-3 font-mono font-bold text-sm">Snippet</th>
                  <th className="text-left py-3 font-mono font-bold text-sm">Timestamp</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredReplies.map((reply) => (
                  <tr 
                    key={reply.id} 
                    className="border-b border-border hover:bg-muted-bg transition-colors cursor-pointer"
                    onClick={() => setSelectedReply(reply)}
                  >
                    <td className="py-3 font-medium">{reply.lead}</td>
                    <td className="py-3 text-muted-text">{reply.company}</td>
                    <td className="py-3">{reply.campaign}</td>
                    <td className="py-3">
                      <Badge variant={
                        reply.disposition === "positive" ? "positive" :
                        reply.disposition === "neutral" ? "neutral" :
                        reply.disposition === "not interested" ? "negative" :
                        "unsub"
                      }>
                        {reply.disposition === "positive" ? "Positive" :
                         reply.disposition === "neutral" ? "Neutral" :
                         reply.disposition === "not interested" ? "Not Interested" :
                         "Unsub"}
                      </Badge>
                    </td>
                    <td className="py-3 text-muted-text max-w-xs truncate">
                      {reply.snippet}
                    </td>
                    <td className="py-3 text-muted-text font-mono text-sm">
                      {reply.timestamp}
                    </td>
                    <td className="py-3">
                      <MessageSquare className="h-4 w-4 text-muted-text" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredReplies.length === 0 && (
            <div className="text-center py-12 text-muted-text">
              No replies found for the selected filter.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reply Detail Sheet */}
      <Sheet open={!!selectedReply} onOpenChange={() => setSelectedReply(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="font-mono">
              Reply from {selectedReply?.lead}
            </SheetTitle>
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
                  <Badge variant={
                    selectedReply.disposition === "positive" ? "positive" :
                    selectedReply.disposition === "neutral" ? "neutral" :
                    selectedReply.disposition === "not interested" ? "negative" :
                    "unsub"
                  }>
                    {selectedReply.disposition === "positive" ? "Positive" :
                     selectedReply.disposition === "neutral" ? "Neutral" :
                     selectedReply.disposition === "not interested" ? "Not Interested" :
                     "Unsub"}
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="font-mono font-bold mb-3">Full Reply</h4>
                <div className="p-4 bg-muted-bg rounded-lg border-l-4 border-cwt-plum">
                  <pre className="whitespace-pre-wrap text-sm font-inter leading-relaxed">
                    {selectedReply.fullReply}
                  </pre>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="plum" size="sm">
                  Mark as Lead
                </Button>
                <Button variant="outline" size="sm">
                  Add to CRM
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
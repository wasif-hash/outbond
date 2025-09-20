"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Play, Pause, MoreHorizontal } from "lucide-react"

const campaigns = [
  {
    id: 1,
    name: "Q3 Utility Outreach",
    status: "active",
    leadsInQueue: 89,
    sentToday: 23,
    totalSent: 156,
    replies: 8,
    bookings: 2,
    lastActivity: "2 hours ago"
  },
  {
    id: 2, 
    name: "Telecom Decision Makers",
    status: "paused",
    leadsInQueue: 45,
    sentToday: 0,
    totalSent: 87,
    replies: 5,
    bookings: 1,
    lastActivity: "1 day ago"
  },
  {
    id: 3,
    name: "Energy Sector Pilots",
    status: "active", 
    leadsInQueue: 23,
    sentToday: 12,
    totalSent: 234,
    replies: 15,
    bookings: 4,
    lastActivity: "45 min ago"
  },
]

const activityFeed = [
  { time: "2:30 PM", event: "Email sent to Marco Ruiz", status: "sent" },
  { time: "2:15 PM", event: "Reply received from Jane Doe", status: "reply" },
  { time: "1:45 PM", event: "Email sent to Priya Patel", status: "sent" },
  { time: "12:30 PM", event: "Booking confirmed with John Smith", status: "booking" },
  { time: "11:15 AM", event: "Email bounced for old.contact@defunct.com", status: "bounce" },
]

export default function Campaigns() {
  const [selectedCampaign, setSelectedCampaign] = useState<typeof campaigns[0] | null>(null)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-mono font-bold text-foreground">Campaigns</h1>
        <p className="text-muted-text mt-1">Manage and monitor your outbound email campaigns</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign List */}
        <div className="lg:col-span-2 space-y-4">
          {campaigns.map((campaign) => (
            <Card 
              key={campaign.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedCampaign(campaign)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-mono font-bold mb-2">{campaign.name}</h3>
                    <Badge variant={campaign.status === "active" ? "positive" : "neutral"}>
                      {campaign.status === "active" ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-text">In Queue</div>
                    <div className="font-mono font-bold text-lg">{campaign.leadsInQueue}</div>
                  </div>
                  <div>
                    <div className="text-muted-text">Sent Today</div>
                    <div className="font-mono font-bold text-lg">{campaign.sentToday}</div>
                  </div>
                  <div>
                    <div className="text-muted-text">Replies</div>
                    <div className="font-mono font-bold text-lg">{campaign.replies}</div>
                  </div>
                  <div>
                    <div className="text-muted-text">Bookings</div>
                    <div className="font-mono font-bold text-lg">{campaign.bookings}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div className="text-xs text-muted-text">
                    Last activity: {campaign.lastActivity}
                  </div>
                  <div className="flex gap-2">
                    {campaign.status === "active" ? (
                      <Button variant="outline" size="sm">
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </Button>
                    ) : (
                      <Button variant="plum" size="sm">
                        <Play className="h-4 w-4 mr-1" />
                        Resume
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Activity Feed */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-mono">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityFeed.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="text-xs text-muted-text font-mono min-w-[4rem]">
                      {activity.time}
                    </div>
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      activity.status === "sent" ? "bg-cwt-plum" :
                      activity.status === "reply" ? "bg-electric-blue" :
                      activity.status === "booking" ? "bg-status-positive" :
                      "bg-status-bounce"
                    }`} />
                    <div className="text-sm text-foreground leading-5">
                      {activity.event}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Campaign Detail Sheet */}
      <Sheet open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="font-mono">
              {selectedCampaign?.name}
            </SheetTitle>
          </SheetHeader>
          
          {selectedCampaign && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted-bg rounded-lg">
                  <div className="text-2xl font-mono font-bold">{selectedCampaign.totalSent}</div>
                  <div className="text-sm text-muted-text">Total Sent</div>
                </div>
                <div className="text-center p-4 bg-muted-bg rounded-lg">
                  <div className="text-2xl font-mono font-bold">{selectedCampaign.replies}</div>
                  <div className="text-sm text-muted-text">Replies</div>
                </div>
              </div>

              <div>
                <h4 className="font-mono font-bold mb-3">Campaign Activity</h4>
                <div className="space-y-3">
                  {activityFeed.slice(0, 3).map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3 text-sm">
                      <div className="text-muted-text font-mono min-w-[4rem]">
                        {activity.time}
                      </div>
                      <div className="text-foreground">
                        {activity.event}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
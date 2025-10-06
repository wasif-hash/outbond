import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from "lucide-react"

const kpiData = [
  { title: "New Leads", value: "142", change: "+12%", trend: "up" },
  { title: "Queued", value: "89", change: "-3%", trend: "down" },
  { title: "Replies", value: "23", change: "+8%", trend: "up" },
  { title: "Bookings", value: "7", change: "0%", trend: "neutral" },
  { title: "Errors", value: "2", change: "-50%", trend: "down" },
]

const activityFeed = [
  { time: "10:23", event: "New booking confirmed", contact: "Marco Ruiz", type: "booking" },
  { time: "09:55", event: "Positive reply received", contact: "Jane Doe", type: "reply" },
  { time: "09:12", event: "Campaign launched", contact: "Q3 Utility Outreach", type: "campaign" },
  { time: "08:45", event: "Lead imported", contact: "15 new contacts", type: "import" },
  { time: "08:30", event: "Suppression added", contact: "competitor@rival.com", type: "suppression" },
]

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-mono font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">System overview and performance metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiData.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 ">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              {kpi.trend === "up" && <ArrowUpIcon className="h-4 w-4" style={{ color: "hsl(var(--status-positive))" }} />}
              {kpi.trend === "down" && <ArrowDownIcon className="h-4 w-4" style={{ color: "hsl(var(--status-bounce))" }} />}
              {kpi.trend === "neutral" && <MinusIcon className="h-4 w-4" style={{ color: "hsl(var(--status-neutral))" }} />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-bold">{kpi.value}</div>
              <div className={`text-xs`} style={{
                color: kpi.trend === "up" ? "hsl(var(--status-positive))" : 
                       kpi.trend === "down" ? "hsl(var(--status-bounce))" : 
                       "hsl(var(--status-neutral))"
              }}>
                {kpi.change} from yesterday
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Charts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-mono">Reply Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between space-x-2 px-4">
              {[12, 18, 15, 22, 28, 25, 31].map((value, index) => (
                <div key={index} className="flex-1 bg-muted rounded-sm relative group">
                  <div 
                    className="rounded-sm transition-all duration-200 group-hover:opacity-80"
                    style={{ 
                      height: `${(value / 31) * 100}%`,
                      backgroundColor: "hsl(var(--cwt-plum))"
                    }}
                  />
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center text-xs text-muted-foreground mt-8">Last 7 days</div>
          </CardContent>
        </Card>

        {/* Today's Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-mono">Today's Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activityFeed.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="text-sm text-muted-foreground font-mono min-w-[3rem]">
                    {activity.time}
                  </div>
                  <div className="w-2 h-2 rounded-full mt-2" style={{
                    backgroundColor: activity.type === "booking" ? "hsl(var(--status-positive))" :
                                   activity.type === "reply" ? "hsl(var(--electric-blue))" :
                                   activity.type === "campaign" ? "hsl(var(--cwt-plum))" :
                                   activity.type === "import" ? "hsl(var(--status-neutral))" :
                                   "hsl(var(--status-bounce))"
                  }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {activity.event}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {activity.contact}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
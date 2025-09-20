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
        <p className="text-muted-text mt-1">System overview and performance metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiData.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-text">{kpi.title}</CardTitle>
              {kpi.trend === "up" && <ArrowUpIcon className="h-4 w-4 text-status-positive" />}
              {kpi.trend === "down" && <ArrowDownIcon className="h-4 w-4 text-status-bounce" />}
              {kpi.trend === "neutral" && <MinusIcon className="h-4 w-4 text-status-neutral" />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-bold">{kpi.value}</div>
              <div className={`text-xs ${
                kpi.trend === "up" ? "text-status-positive" : 
                kpi.trend === "down" ? "text-status-bounce" : 
                "text-status-neutral"
              }`}>
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
                <div key={index} className="flex-1 bg-muted-bg rounded-sm relative group">
                  <div 
                    className="bg-cwt-plum rounded-sm transition-all duration-200 group-hover:bg-cwt-plum-light"
                    style={{ height: `${(value / 31) * 100}%` }}
                  />
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-muted-text">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center text-xs text-muted-text mt-8">Last 7 days</div>
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
                  <div className="text-sm text-muted-text font-mono min-w-[3rem]">
                    {activity.time}
                  </div>
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.type === "booking" ? "bg-status-positive" :
                    activity.type === "reply" ? "bg-electric-blue" :
                    activity.type === "campaign" ? "bg-cwt-plum" :
                    activity.type === "import" ? "bg-status-neutral" :
                    "bg-status-bounce"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {activity.event}
                    </div>
                    <div className="text-sm text-muted-text truncate">
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
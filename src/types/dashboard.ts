export type DashboardTrendPoint = {
  date: string
  count: number
}

export type DashboardActivityType = "lead" | "email" | "campaign"

export type DashboardActivityItem = {
  id: string
  type: DashboardActivityType
  title: string
  description: string
  occurredAt: string
}

export type DashboardAnalyticsResponse = {
  metrics: {
    leadsWritten: number
    outreachEmailsSent: number
    userCount: number | null
    repliesCount?: number
  }
  trends: {
    leadWrites: DashboardTrendPoint[]
    outreachSends: DashboardTrendPoint[]
  }
  activity: DashboardActivityItem[]
}

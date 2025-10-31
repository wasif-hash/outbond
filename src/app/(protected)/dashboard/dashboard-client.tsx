"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoaderThree } from "@/components/ui/loader"
import { getApiClient } from "@/lib/http-client"
import type { DashboardAnalyticsResponse, DashboardActivityItem } from "@/types/dashboard"

type TrendDirection = "up" | "down" | "neutral"

type KpiMetric = {
  key: string
  title: string
  value: string
  trend: TrendDirection
  changeLabel: string
  description: string
  muted?: boolean
}

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
})

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
})

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "—"
  }
  return numberFormatter.format(value)
}

const deriveChange = (points: Array<{ count: number }>): { trend: TrendDirection; label: string } => {
  if (!points || points.length < 2) {
    return { trend: "neutral", label: "No change" }
  }
  const current = points[points.length - 1]?.count ?? 0
  const previous = points[points.length - 2]?.count ?? 0
  const delta = current - previous
  if (delta === 0) {
    return { trend: "neutral", label: "No change" }
  }
  const label = `${delta > 0 ? "+" : ""}${delta.toFixed(0)} vs yesterday`
  return { trend: delta > 0 ? "up" : "down", label }
}

const trendColor = (trend: TrendDirection) => {
  switch (trend) {
    case "up":
      return "hsl(var(--status-positive))"
    case "down":
      return "hsl(var(--status-bounce))"
    default:
      return "hsl(var(--status-neutral))"
  }
}

const trendIcon = (trend: TrendDirection) => {
  if (trend === "up") return <ArrowUpIcon className="h-4 w-4" style={{ color: trendColor(trend) }} />
  if (trend === "down") return <ArrowDownIcon className="h-4 w-4" style={{ color: trendColor(trend) }} />
  return <MinusIcon className="h-4 w-4" style={{ color: trendColor(trend) }} />
}

const getActivityAccent = (type: DashboardActivityItem["type"]) => {
  switch (type) {
    case "email":
      return "hsl(var(--electric-blue))"
    case "campaign":
      return "hsl(var(--cwt-plum))"
    case "lead":
    default:
      return "hsl(var(--status-positive))"
  }
}

export function DashboardClient() {
  const client = useMemo(() => getApiClient(), [])

  const {
    data: analytics,
    isLoading,
    isFetching,
    error,
  } = useQuery<DashboardAnalyticsResponse>({
    queryKey: ["dashboard-analytics"],
    queryFn: async () => {
      const response = await client.get<DashboardAnalyticsResponse>("/api/dashboard/analytics")
      return response.data
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  })

  const chartData = useMemo(() => {
    if (!analytics) {
      return []
    }
    const combined = new Map<
      string,
      {
        date: string
        leadCount: number
        outreachCount: number
      }
    >()

    analytics.trends.leadWrites.forEach((point) => {
      combined.set(point.date, {
        date: point.date,
        leadCount: point.count,
        outreachCount: 0,
      })
    })

    analytics.trends.outreachSends.forEach((point) => {
      const existing = combined.get(point.date)
      if (existing) {
        existing.outreachCount = point.count
      } else {
        combined.set(point.date, {
          date: point.date,
          leadCount: 0,
          outreachCount: point.count,
        })
      }
    })

    return Array.from(combined.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [analytics])

  const maxChartValue = useMemo(() => {
    if (chartData.length === 0) {
      return 1
    }
    return chartData.reduce((max, point) => {
      return Math.max(max, point.leadCount, point.outreachCount)
    }, 1)
  }, [chartData])

  const leadTrendChange = useMemo(
    () => deriveChange(analytics?.trends.leadWrites ?? []),
    [analytics?.trends.leadWrites],
  )

  const outreachTrendChange = useMemo(
    () => deriveChange(analytics?.trends.outreachSends ?? []),
    [analytics?.trends.outreachSends],
  )

  const kpiMetrics: KpiMetric[] = useMemo(() => {
    return [
      {
        key: "leads",
        title: "New Leads",
        value: formatNumber(analytics?.metrics.leadsWritten ?? (isLoading ? null : 0)),
        trend: leadTrendChange.trend,
        changeLabel: isLoading ? "Loading…" : leadTrendChange.label,
        description: "Leads written to Google Sheets",
      },
      {
        key: "outreach",
        title: "Outreached Emails",
        value: formatNumber(analytics?.metrics.outreachEmailsSent ?? (isLoading ? null : 0)),
        trend: outreachTrendChange.trend,
        changeLabel: isLoading ? "Loading…" : outreachTrendChange.label,
        description: "Sent via manual outreach",
      },
      {
        key: "replies",
        title: "Replies",
        value: "0",
        trend: "neutral",
        changeLabel: "Tracking coming soon",
        description: "Reply sync is being configured",
        muted: true,
      },
      {
        key: "bookings",
        title: "Bookings",
        value: "0",
        trend: "neutral",
        changeLabel: "Sync coming soon",
        description: "Calendar integration pending",
        muted: true,
      },
      {
        key: "users",
        title: "Active Users",
        value: formatNumber(analytics?.metrics.userCount ?? (analytics ? null : 0)),
        trend: "neutral",
        changeLabel:
          analytics?.metrics.userCount === null ? "Admin only" : "Synced from Users directory",
        description:
          analytics?.metrics.userCount === null
            ? "Admins can view the user directory"
            : "Total users with dashboard access",
      },
    ]
  }, [
    analytics,
    isLoading,
    leadTrendChange.label,
    leadTrendChange.trend,
    outreachTrendChange.label,
    outreachTrendChange.trend,
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-mono font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">System overview and performance metrics</p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Unable to load analytics right now. Please try again shortly.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {kpiMetrics.map((metric) => (
          <Card key={metric.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle
                className={`text-sm font-medium ${metric.muted ? "text-muted-foreground/70" : "text-muted-foreground"}`}
              >
                {metric.title}
              </CardTitle>
              {!metric.muted ? trendIcon(metric.trend) : null}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-mono font-bold ${metric.muted ? "text-muted-foreground" : "text-foreground"}`}
              >
                {metric.value}
              </div>
              <div
                className={`text-xs ${metric.muted ? "text-muted-foreground/80" : ""}`}
                style={{ color: metric.muted ? undefined : trendColor(metric.trend) }}
              >
                {metric.changeLabel}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{metric.description}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-mono">Pipeline over time</CardTitle>
              <p className="text-xs text-muted-foreground">
                Leads written to sheets vs outreach emails over the last 7 days.
              </p>
            </div>
            {isFetching ? (
              <span className="text-xs font-mono uppercase text-muted-foreground">Refreshing…</span>
            ) : null}
          </CardHeader>
          <CardContent>
            {isLoading || !analytics ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <LoaderThree />
                Loading analytics…
              </div>
            ) : (
              <>
                <div className="h-64 flex items-end justify-between space-x-3 px-2">
                  {chartData.map((point) => {
                    const leadHeight = Math.round((point.leadCount / maxChartValue) * 100)
                    const outreachHeight = Math.round((point.outreachCount / maxChartValue) * 100)
                    const date = new Date(point.date)
                    const label = dayLabelFormatter.format(date)
                    return (
                      <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-full w-full items-end gap-1">
                          <div
                            className="flex-1 rounded-sm bg-muted"
                            title={`${point.leadCount} leads on ${label}`}
                          >
                            <div
                              className="w-full rounded-sm"
                              style={{
                                height: `${leadHeight}%`,
                                backgroundColor: "hsl(var(--cwt-plum))",
                              }}
                            />
                          </div>
                          <div
                            className="flex-1 rounded-sm bg-muted"
                            title={`${point.outreachCount} emails on ${label}`}
                          >
                            <div
                              className="w-full rounded-sm"
                              style={{
                                height: `${outreachHeight}%`,
                                backgroundColor: "hsl(var(--electric-blue))",
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-xs font-mono text-muted-foreground">{label}</div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: "hsl(var(--cwt-plum))" }}
                    />
                    Leads written
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: "hsl(var(--electric-blue))" }}
                    />
                    Emails sent
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-mono">Live activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !analytics ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <LoaderThree />
                Loading activity…
              </div>
            ) : analytics.activity.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
                No recent activity yet. Run a campaign or send outreach to see live updates.
              </div>
            ) : (
              <div className="space-y-4">
                {analytics.activity.map((item) => {
                  const occurred = new Date(item.occurredAt)
                  return (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className="text-sm font-mono text-muted-foreground min-w-[3.5rem]">
                        {timeFormatter.format(occurred)}
                      </div>
                      <div
                        className="mt-1 h-2 w-2 rounded-full"
                        style={{ backgroundColor: getActivityAccent(item.type) }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{item.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

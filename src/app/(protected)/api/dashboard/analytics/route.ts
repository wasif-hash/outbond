import { NextRequest, NextResponse } from "next/server"

import { verifyAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { DashboardAnalyticsResponse } from "@/types/dashboard"

const TREND_WINDOW_DAYS = 7

const startOfDay = (date: Date): Date => {
  const clone = new Date(date)
  clone.setHours(0, 0, 0, 0)
  return clone
}

const formatDayKey = (date: Date): string => startOfDay(date).toISOString()

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = auth.user.userId
    const isAdmin = auth.user.role === "admin"

    const today = startOfDay(new Date())
    const trendStart = new Date(today)
    trendStart.setDate(trendStart.getDate() - (TREND_WINDOW_DAYS - 1))

    const [leadWriteAggregate, leadJobs, outreachSentCount, outreachJobs, totalUserCount, recentLeads, recentCampaignJobs] =
      await Promise.all([
        prisma.campaignJob.aggregate({
          where: {
            campaign: {
              userId,
            },
            status: "SUCCEEDED",
          },
          _sum: {
            leadsWritten: true,
          },
        }),
        prisma.campaignJob.findMany({
          where: {
            campaign: {
              userId,
            },
            finishedAt: {
              not: null,
              gte: trendStart,
            },
          },
          select: {
            id: true,
            finishedAt: true,
            createdAt: true,
            leadsWritten: true,
            campaign: {
              select: {
                name: true,
              },
            },
          },
        }),
        prisma.emailSendJob.count({
          where: {
            userId,
            status: "SENT",
          },
        }),
        prisma.emailSendJob.findMany({
          where: {
            userId,
            OR: [
              {
                sentAt: {
                  not: null,
                  gte: trendStart,
                },
              },
              {
                createdAt: {
                  gte: trendStart,
                },
              },
            ],
          },
          select: {
            id: true,
            leadEmail: true,
            subject: true,
            status: true,
            createdAt: true,
            sentAt: true,
          },
        }),
        isAdmin
          ? prisma.user.count({
              where: {
                role: {
                  in: ["admin", "user"],
                },
              },
            })
          : null,
        prisma.lead.findMany({
          where: {
            userId,
            createdAt: {
              gte: trendStart,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
          select: {
            id: true,
            email: true,
            company: true,
            createdAt: true,
          },
        }),
        prisma.campaignJob.findMany({
          where: {
            campaign: {
              userId,
            },
            createdAt: {
              gte: trendStart,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
          select: {
            id: true,
            status: true,
            createdAt: true,
            finishedAt: true,
            campaign: {
              select: {
                name: true,
              },
            },
          },
        }),
      ])

    const leadTrendMap = new Map<string, number>()
    const outreachTrendMap = new Map<string, number>()

    for (let i = 0; i < TREND_WINDOW_DAYS; i++) {
      const day = new Date(trendStart)
      day.setDate(trendStart.getDate() + i)
      const key = formatDayKey(day)
      leadTrendMap.set(key, 0)
      outreachTrendMap.set(key, 0)
    }

    leadJobs.forEach((job) => {
      const referenceDate = job.finishedAt ?? job.createdAt
      if (!referenceDate) {
        return
      }
      const key = formatDayKey(referenceDate)
      if (!leadTrendMap.has(key)) {
        return
      }
      const current = leadTrendMap.get(key) ?? 0
      leadTrendMap.set(key, current + Math.max(job.leadsWritten ?? 0, 0))
    })

    outreachJobs.forEach((job) => {
      const referenceDate = job.sentAt ?? job.createdAt
      if (!referenceDate) {
        return
      }
      const key = formatDayKey(referenceDate)
      if (!outreachTrendMap.has(key)) {
        return
      }
      const current = outreachTrendMap.get(key) ?? 0
      outreachTrendMap.set(key, current + 1)
    })

    const leadTrend = Array.from(leadTrendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date,
        count,
      }))

    const outreachTrend = Array.from(outreachTrendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date,
        count,
      }))

    const emailActivityItems = outreachJobs
      .map((job) => ({
        id: `email-${job.id}`,
        type: "email" as const,
        title: job.status === "SENT" ? "Email sent" : job.status === "FAILED" ? "Email failed" : "Email queued",
        description: job.leadEmail ? `${job.leadEmail}${job.subject ? ` — ${job.subject}` : ""}` : job.subject ?? "",
        occurredAt: (job.sentAt ?? job.createdAt).toISOString(),
      }))
      .slice(0, 20)

    const leadActivityItems = recentLeads.map((lead) => ({
      id: `lead-${lead.id}`,
      type: "lead" as const,
      title: "Lead added",
      description: lead.company ? `${lead.email} · ${lead.company}` : lead.email,
      occurredAt: lead.createdAt.toISOString(),
    }))

    const campaignActivityItems = recentCampaignJobs.map((job) => ({
      id: `campaign-${job.id}`,
      type: "campaign" as const,
      title: job.campaign?.name ? `Campaign ${job.status.toLowerCase()}` : `Campaign ${job.status.toLowerCase()}`,
      description: job.campaign?.name ?? "Campaign update",
      occurredAt: (job.finishedAt ?? job.createdAt).toISOString(),
    }))

    const activity = [...emailActivityItems, ...leadActivityItems, ...campaignActivityItems]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 20)

    const response: DashboardAnalyticsResponse = {
      metrics: {
        leadsWritten: leadWriteAggregate._sum.leadsWritten ?? 0,
        outreachEmailsSent: outreachSentCount,
        userCount: isAdmin ? totalUserCount ?? 0 : null,
      },
      trends: {
        leadWrites: leadTrend,
        outreachSends: outreachTrend,
      },
      activity,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Dashboard analytics error:", error)
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 })
  }
}

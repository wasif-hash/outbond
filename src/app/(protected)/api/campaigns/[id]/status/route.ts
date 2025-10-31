// src/app/api/campaigns/[id]/status/route.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined> | undefined>
}

const resolveIdParam = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? value[0] ?? null : typeof value === 'string' ? value : null

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params
    const campaignId = resolveIdParam(params?.id)
    if (!campaignId) {
      return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 })
    }

    const authResult = await verifyAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: authResult.user.userId,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Get latest job status
    const latestJob = await prisma.campaignJob.findFirst({
      where: {
        campaignId: campaignId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        jobAttempts: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
      },
    })

    // Get lead counts
    const leadCounts = await prisma.lead.groupBy({
      by: ['campaignId'],
      where: {
        campaignId: campaignId,
      },
      _count: true,
    })

    const status = {
      campaign,
      latestJob: latestJob ? {
        id: latestJob.id,
        status: latestJob.status,
        attemptCount: latestJob.attemptCount,
        startedAt: latestJob.startedAt,
        finishedAt: latestJob.finishedAt,
        leadsProcessed: latestJob.leadsProcessed,
        leadsWritten: latestJob.leadsWritten,
        totalPages: latestJob.totalPages,
        lastError: latestJob.lastError,
        latestAttempt: latestJob.jobAttempts[0] || null,
      } : null,
      totalLeads: leadCounts[0]?._count || 0,
    }

    return NextResponse.json(status)

  } catch (error) {
    console.error('Get campaign status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

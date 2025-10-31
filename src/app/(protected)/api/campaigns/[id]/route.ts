// src/app/api/campaigns/[id]/route.ts
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { JobStatus } from '@prisma/client'

import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { removePendingCampaignJobs } from '@/lib/queue'

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined> | undefined>
}

const resolveIdParam = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? value[0] ?? null : typeof value === 'string' ? value : null

const getCampaignId = async (context: RouteContext): Promise<string | null> => {
  const params = await context.params
  return resolveIdParam(params?.id)
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const campaignId = await getCampaignId(context)
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
      include: {
        googleSheet: true,
        campaignJobs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            jobAttempts: {
              orderBy: { attemptNumber: 'desc' },
              take: 1,
            },
          },
        },
        _count: {
          select: {
            leads: true,
          },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ campaign })

  } catch (error) {
    console.error('Get campaign error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const campaignId = await getCampaignId(context)
    if (!campaignId) {
      return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 })
    }

    const authResult = await verifyAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { isActive, name, keywords, location, maxLeads } = body

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: authResult.user.userId,
      },
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(name && { name }),
        ...(keywords && { keywords }),
        ...(location && { location }),
        ...(maxLeads && { maxLeads }),
      },
    })

    if (isActive === false) {
      await cancelCampaignJobs(campaignId, 'Campaign paused by user')
    }

    revalidateTag(`user-campaigns:${authResult.user.userId}`)

    return NextResponse.json({ campaign: updatedCampaign })

  } catch (error) {
    console.error('Update campaign error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const campaignId = await getCampaignId(context)
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
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    await cancelCampaignJobs(campaignId, 'Campaign deleted by user')

    await prisma.campaign.delete({
      where: { id: campaignId },
    })

    revalidateTag(`user-campaigns:${authResult.user.userId}`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete campaign error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function cancelCampaignJobs(campaignId: string, reason: string) {
  const now = new Date()

  await removePendingCampaignJobs(campaignId)

  await prisma.campaignJob.updateMany({
    where: {
      campaignId,
      status: {
        in: [JobStatus.PENDING, JobStatus.RUNNING],
      },
    },
    data: {
      status: JobStatus.CANCELLED,
      finishedAt: now,
      lastError: reason,
      nextRunAt: null,
    },
  })

  await prisma.jobAttempt.updateMany({
    where: {
      campaignJob: {
        campaignId,
      },
      status: {
        in: [JobStatus.PENDING, JobStatus.RUNNING],
      },
    },
    data: {
      status: JobStatus.CANCELLED,
      finishedAt: now,
      error: reason,
    },
  })
}

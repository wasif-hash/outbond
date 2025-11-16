// src/app/api/campaigns/[id]/retry/route.ts
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { generateIdempotencyKey } from '@/lib/utils'
import { enqueueJob } from '@/lib/queue'

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined> | undefined>
}

const resolveIdParam = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? value[0] ?? null : typeof value === 'string' ? value : null

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const resolvedParams = await context.params
    const campaignId = resolveIdParam(resolvedParams?.id)
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

    // Check if there's already a running job
    const runningJob = await prisma.campaignJob.findFirst({
      where: {
        campaignId,
        status: 'RUNNING',
      },
    })

    if (runningJob) {
      return NextResponse.json(
        { error: 'Campaign job is already running' },
        { status: 409 }
      )
    }

    // Generate new idempotency key for retry
    const idempotencyKey = generateIdempotencyKey(campaign.id, 'retry', new Date().getTime().toString())

    // Create new campaign job for retry
    const campaignJob = await prisma.campaignJob.create({
      data: {
        campaignId: campaign.id,
        idempotencyKey,
        nextRunAt: new Date(),
      },
    })

    // Enqueue the retry job
    await enqueueJob('lead-fetch', {
      campaignId: campaign.id,
      jobId: campaignJob.id,
      userId: authResult.user.userId,
      isRetry: true,
    })

    revalidateTag(`user-campaigns:${authResult.user.userId}`)

    return NextResponse.json({
      success: true,
      message: 'Campaign retry queued',
      jobId: campaignJob.id,
    })

  } catch (error) {
    console.error('Retry campaign error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

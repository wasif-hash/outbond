// src/app/api/campaigns/route.ts
"use server"
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { generateIdempotencyKey } from '@/lib/utils'
import { z } from 'zod'
import { enqueueJob } from '@/lib/queue'

const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  nicheOrJobTitle: z.string().min(1).max(255),
  keywords: z.string().max(1000),
  location: z.string().max(255),
  googleSheetId: z.string().min(1),
  maxLeads: z.number().int().positive().max(10000).optional().default(1000),
  pageSize: z.number().int().positive().max(100).optional().default(50),
})

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createCampaignSchema.parse(body)

    // Verify Google Sheet belongs to user
    const googleSheet = await prisma.googleSheet.findFirst({
      where: {
        id: validatedData.googleSheetId,
        userId: authResult.user.userId,
      },
    })

    if (!googleSheet) {
      return NextResponse.json(
        { error: 'Google Sheet not found or not accessible' },
        { status: 404 }
      )
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        userId: authResult.user.userId,
        name: validatedData.name,
        nicheOrJobTitle: validatedData.nicheOrJobTitle,
        keywords: validatedData.keywords,
        location: validatedData.location,
        googleSheetId: validatedData.googleSheetId,
        maxLeads: validatedData.maxLeads,
        pageSize: validatedData.pageSize,
      },
    })

    // Generate idempotency key for the job
    const idempotencyKey = generateIdempotencyKey(campaign.id, 'initial')

    // Create and enqueue campaign job
    const campaignJob = await prisma.campaignJob.create({
      data: {
        campaignId: campaign.id,
        idempotencyKey,
        nextRunAt: new Date(),
      },
    })

    // Enqueue the job
    await enqueueJob('lead-fetch', {
      campaignId: campaign.id,
      jobId: campaignJob.id,
      userId: authResult.user.userId,
    })

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: 'queued',
      },
      jobId: campaignJob.id,
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.message },
        { status: 400 }
      )
    }

    console.error('Create campaign error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const campaigns = await prisma.campaign.findMany({
      where: {
        userId: authResult.user.userId,
      },
      include: {
        googleSheet: {
          select: {
            title: true,
            spreadsheetId: true,
          },
        },
        campaignJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            status: true,
            startedAt: true,
            finishedAt: true,
            leadsProcessed: true,
            lastError: true,
            attemptCount: true,
          },
        },
        _count: {
          select: {
            leads: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    })

    const total = await prisma.campaign.count({
      where: {
        userId: authResult.user.userId,
      },
    })

    const formattedCampaigns = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      nicheOrJobTitle: campaign.nicheOrJobTitle,
      keywords: campaign.keywords,
      location: campaign.location,
      maxLeads: campaign.maxLeads,
      isActive: campaign.isActive,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      googleSheet: campaign.googleSheet,
      latestJob: campaign.campaignJobs[0] || null,
      totalLeads: campaign._count.leads,
    }))

    return NextResponse.json({
      campaigns: formattedCampaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

  } catch (error) {
    console.error('Get campaigns error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
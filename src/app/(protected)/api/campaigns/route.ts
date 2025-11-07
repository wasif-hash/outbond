// src/app/api/campaigns/route.ts
import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { Campaign } from '@prisma/client'

import { generateIdempotencyKey } from '@/lib/utils'
import { getCampaignsForUser } from '@/lib/apollo/campaigns'
import { z } from 'zod'
import { enqueueJob } from '@/lib/queue'
import {
  createAuthorizedClient,
  getSpreadsheetInfo,
  refreshTokenIfNeeded,
} from '@/lib/google-sheet/google-sheet'

export const runtime = 'nodejs'

const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  jobTitles: z.array(z.string().min(1)).min(1).max(10).transform(arr => arr.join(', ')),
  keywords: z.string().max(1000).optional().transform(val => val || ''),
  locations: z.array(z.string().min(1)).min(1).max(10).transform(arr => arr.join(', ')),
  googleSheetId: z.string().min(1),
  maxLeads: z.number().int().positive().max(10000).default(1000),
  pageSize: z.number().int().positive().max(100).default(25),
  includeDomains: z.string().max(1000).optional().transform(val => val || undefined),
  excludeDomains: z.string().max(1000).optional().transform(val => val || undefined),
  searchMode: z.enum(['balanced', 'conserve']).default('balanced'),
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
    let googleSheet = await prisma.googleSheet.findFirst({
      where: {
        spreadsheetId: validatedData.googleSheetId,
        userId: authResult.user.userId,
      },
    })

    if (!googleSheet) {
      return NextResponse.json(
        { error: 'Google Sheet not found or not accessible' },
        { status: 404 }
      )
    }

    if (!googleSheet.sheetTitle || !googleSheet.range) {
      const tokenRecord = await prisma.googleOAuthToken.findUnique({
        where: { userId: authResult.user.userId },
      })

      if (!tokenRecord) {
        return NextResponse.json(
          { error: 'Google Sheets token not found. Please reconnect your Google account.' },
          { status: 400 },
        )
      }

      const oauth2Client = await createAuthorizedClient(
        tokenRecord.accessToken,
        tokenRecord.refreshToken,
      )

      if (new Date() >= tokenRecord.expiresAt) {
        await refreshTokenIfNeeded(oauth2Client, tokenRecord, authResult.user.userId)
      }

      try {
        const sheetInfo = await getSpreadsheetInfo(oauth2Client, googleSheet.spreadsheetId)
        const primarySheet = sheetInfo.sheets?.[0]?.properties
        const resolvedTitle = primarySheet?.title?.trim() || 'Sheet1'
        const escapedTitle = resolvedTitle.replace(/'/g, "''")
        const quotedTitle = `'${escapedTitle}'`
        const resolvedRange = `${quotedTitle}!A:P`

        googleSheet = await prisma.googleSheet.update({
          where: { id: googleSheet.id },
          data: {
            sheetTitle: resolvedTitle,
            sheetId: primarySheet?.sheetId ?? null,
            range: resolvedRange,
          },
        })
      } catch (metadataError) {
        console.error('Failed to resolve sheet metadata:', metadataError)
        return NextResponse.json(
          { error: 'Unable to inspect the selected Google Sheet. Please ensure it exists and you have access.' },
          { status: 400 },
        )
      }
    }

    // Prepare campaign data, removing undefined values
    const campaignData: Prisma.CampaignUncheckedCreateInput = {
      userId: authResult.user.userId,
      name: validatedData.name,
      nicheOrJobTitle: validatedData.jobTitles, // Already joined by schema transform
      keywords: validatedData.keywords, // Already handled by schema transform
      location: validatedData.locations, // Already joined by schema transform
      googleSheetId: googleSheet.id,
      maxLeads: validatedData.maxLeads,
      pageSize: validatedData.pageSize,
      ...(validatedData.includeDomains ? { includeDomains: validatedData.includeDomains } : {}),
      ...(validatedData.excludeDomains ? { excludeDomains: validatedData.excludeDomains } : {}),
      searchMode: validatedData.searchMode,
    }

    let campaign: Campaign

    try {
      campaign = await prisma.campaign.create({
        data: campaignData,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientValidationError && error.message.includes('Unknown argument `searchMode`')) {
        console.warn('Prisma client does not yet recognise searchMode field, retrying without it. Consider regenerating Prisma client.')

        const fallbackData: Prisma.CampaignUncheckedCreateInput = { ...campaignData }
        const { searchMode } = fallbackData
        delete fallbackData.searchMode

        campaign = await prisma.campaign.create({
          data: fallbackData,
        })

        if (searchMode) {
          await prisma.$executeRaw`
            UPDATE "Campaign"
            SET "searchMode" = ${searchMode}
            WHERE "id" = ${campaign.id}
          `
          campaign = { ...campaign, searchMode } as Campaign
        }
      } else {
        throw error
      }
    }

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

    revalidateTag(`user-campaigns:${authResult.user.userId}`)

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
    const pageParam = parseInt(searchParams.get('page') || '1', 10)
    const limitParam = parseInt(searchParams.get('limit') || '20', 10)
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 20

    const response = await getCampaignsForUser(authResult.user.userId, { page, limit })

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store',
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

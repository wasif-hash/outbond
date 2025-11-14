import { NextRequest, NextResponse } from 'next/server'

import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  createAuthorizedClient,
  getSpreadsheetData,
  getSpreadsheetInfo,
  refreshTokenIfNeeded,
} from '@/lib/google-sheet/google-sheet'
import { SpreadsheetData } from '@/types/google-sheet'

export const runtime = 'nodejs'

const getApiStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined
  }
  const maybeError = error as { code?: unknown; response?: { status?: unknown } }
  const directStatus = typeof maybeError.code === 'number' ? maybeError.code : undefined
  const nestedStatus = typeof maybeError.response?.status === 'number' ? maybeError.response.status : undefined
  return directStatus ?? nestedStatus
}

type RouteContext = { params: Promise<{ spreadsheetId: string }> }

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { spreadsheetId } = await context.params
    const { searchParams } = new URL(request.url)
    const rangeParam = searchParams.get('range')

    const tokenRecord = await prisma.googleOAuthToken.findUnique({
      where: { userId: authResult.user.userId },
    })

    if (!tokenRecord) {
      return NextResponse.json({ error: 'Google account not connected' }, { status: 400 })
    }

    const oauth2Client = await createAuthorizedClient(
      tokenRecord.accessToken,
      tokenRecord.refreshToken,
    )

    if (new Date() >= tokenRecord.expiresAt) {
      await refreshTokenIfNeeded(oauth2Client, tokenRecord, authResult.user.userId)
    }

    let spreadsheetInfo: Awaited<ReturnType<typeof getSpreadsheetInfo>>
    try {
      spreadsheetInfo = await getSpreadsheetInfo(oauth2Client, spreadsheetId)
    } catch (apiError: unknown) {
      const status = getApiStatus(apiError)
      if (status === 404) {
        return NextResponse.json(
          { error: 'Spreadsheet not found or you do not have access. Verify the Sheet ID and sharing permissions.' },
          { status: 404 },
        )
      }
      throw apiError
    }

    const defaultSheetTitle = spreadsheetInfo.sheets?.[0]?.properties?.title || 'Sheet1'
    const requestedRange = rangeParam || defaultSheetTitle
    const effectiveRange = requestedRange.includes('!')
      ? requestedRange
      : `${requestedRange}!A:P`

    let data: string[][]
    try {
      data = await getSpreadsheetData(oauth2Client, spreadsheetId, effectiveRange)
    } catch (apiError: unknown) {
      const status = getApiStatus(apiError)
      if (status === 404) {
        return NextResponse.json(
          { error: 'Sheet tab or range not found. Confirm the tab name exists and the range is valid (e.g. "Leads!A:P").' },
          { status: 404 },
        )
      }
      throw apiError
    }

    await prisma.googleSheet.upsert({
      where: {
        userId_spreadsheetId: {
          userId: authResult.user.userId,
          spreadsheetId,
        },
      },
      update: {
        lastUsedAt: new Date(),
        title: spreadsheetInfo.properties?.title || spreadsheetId,
        range: effectiveRange,
      },
      create: {
        userId: authResult.user.userId,
        spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        title: spreadsheetInfo.properties?.title || spreadsheetId,
        range: effectiveRange,
        lastUsedAt: new Date(),
      },
    })

    const response: SpreadsheetData = {
      spreadsheet: {
        properties: {
          title: spreadsheetInfo.properties?.title || '',
        },
        sheets: (spreadsheetInfo.sheets || []).map((sheet) => ({
          properties: {
            sheetId: sheet.properties?.sheetId ?? 0,
            title: sheet.properties?.title || '',
          },
        })),
      },
      data,
      sheets:
        spreadsheetInfo.sheets?.map((sheet) => ({
          id: sheet.properties?.sheetId ?? 0,
          title: sheet.properties?.title || '',
        })) || [],
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Get sheet data error:', error)
    return NextResponse.json({ error: 'Failed to fetch sheet data' }, { status: 500 })
  }
}

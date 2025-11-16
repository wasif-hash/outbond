import { NextResponse, NextRequest } from 'next/server'

import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  GoogleDriveApiDisabledError,
  createAuthorizedClient,
  getUserSpreadsheets,
  refreshTokenIfNeeded,
} from '@/lib/google-sheet/google-sheet'
import { GoogleSheetsListResponse } from '@/types/google-sheet'

const mapSheetsForResponse = (sheets: Array<{ spreadsheetId: string; title: string; spreadsheetUrl: string }>) =>
  sheets.map((sheet) => ({
    id: sheet.spreadsheetId,
    name: sheet.title,
    webViewLink: sheet.spreadsheetUrl,
  }))

export async function GET(request: NextRequest) {
  let userId: string | null = null

  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    userId = authResult.user.userId

    const tokenRecord = await prisma.googleOAuthToken.findUnique({
      where: { userId },
    })

    if (!tokenRecord) {
      return NextResponse.json({ error: 'Google account not connected' }, { status: 400 })
    }

    const oauth2Client = await createAuthorizedClient(tokenRecord.accessToken, tokenRecord.refreshToken)

    if (new Date() >= tokenRecord.expiresAt) {
      await refreshTokenIfNeeded(oauth2Client, tokenRecord, userId)
    }

    const spreadsheets = await getUserSpreadsheets(oauth2Client)

    for (const spreadsheet of spreadsheets) {
      await prisma.googleSheet.upsert({
        where: {
          userId_spreadsheetId: {
            userId,
            spreadsheetId: spreadsheet.id,
          },
        },
        update: {
          title: spreadsheet.name,
          spreadsheetUrl: spreadsheet.webViewLink,
          lastUsedAt: new Date(),
        },
        create: {
          userId,
          spreadsheetId: spreadsheet.id,
          spreadsheetUrl: spreadsheet.webViewLink,
          title: spreadsheet.name,
          lastUsedAt: new Date(),
        },
      })
    }

    const storedSheets = await prisma.googleSheet.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    })

    const response: GoogleSheetsListResponse = {
      spreadsheets: mapSheetsForResponse(storedSheets),
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('Get sheets error:', error)

    if (error instanceof GoogleDriveApiDisabledError && userId) {
      const storedSheets = await prisma.googleSheet.findMany({
        where: { userId },
        orderBy: { lastUsedAt: 'desc' },
      })

      if (storedSheets.length > 0) {
        const response: GoogleSheetsListResponse = {
          spreadsheets: mapSheetsForResponse(storedSheets),
          warning: error.message,
        }

        return NextResponse.json(response)
      }

      return NextResponse.json(
        {
          error: error.message,
          requiresDriveEnable: true,
        },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: 'Failed to fetch sheets' }, { status: 500 })
  }
}

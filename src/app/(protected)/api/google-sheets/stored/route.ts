import { NextResponse, NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mapSheetsForResponse = (sheets: Array<{ spreadsheetId: string; title: string; spreadsheetUrl: string }>) =>
  sheets.map((sheet) => ({
    id: sheet.spreadsheetId,
    name: sheet.title,
    webViewLink: sheet.spreadsheetUrl,
  }))

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storedSheets = await prisma.googleSheet.findMany({
      where: { userId: authResult.user.userId },
      select: {
        spreadsheetId: true,
        title: true,
        spreadsheetUrl: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    })

    return NextResponse.json({ spreadsheets: mapSheetsForResponse(storedSheets) })
  } catch (error) {
    console.error('Get stored sheets error:', error)
    return NextResponse.json({ error: 'Failed to fetch stored sheets' }, { status: 500 })
  }
}

import { NextResponse, NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storedSheets = await prisma.googleSheet.findMany({
      where: { userId: authResult.user.userId },
      select: {
        id: true,
        spreadsheetId: true,
        title: true,
        spreadsheetUrl: true,
        lastUsedAt: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    // Transform to match the expected format
    const spreadsheets = storedSheets.map(sheet => ({
      id: sheet.spreadsheetId,
      name: sheet.title,
      webViewLink: sheet.spreadsheetUrl,
    }));

    return NextResponse.json({ spreadsheets });
  } catch (error) {
    console.error('Get stored sheets error:', error);
    return NextResponse.json({ error: 'Failed to fetch stored sheets' }, { status: 500 });
  }
}

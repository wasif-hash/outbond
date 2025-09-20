import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import { createAuthorizedClient, getSpreadsheetData, getSpreadsheetInfo, refreshTokenIfNeeded } from '@/lib/google-sheet';
import { SpreadsheetData } from '@/types/google-sheet';


export async function GET(
  request: NextRequest,
  { params }: { params: { spreadsheetId: string } }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { spreadsheetId } = params;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'Sheet1';

    const tokenRecord = await prisma.googleOAuthToken.findUnique({
      where: { userId: authResult.user.userId },
    });

    if (!tokenRecord) {
      return NextResponse.json({ error: 'Google account not connected' }, { status: 400 });
    }

    const oauth2Client = await createAuthorizedClient(
      tokenRecord.accessToken,
      tokenRecord.refreshToken
    );

    // Check if token needs refresh
    if (new Date() >= tokenRecord.expiresAt) {
      await refreshTokenIfNeeded(oauth2Client, tokenRecord, authResult.user.userId);
    }

    const [spreadsheetInfo, data] = await Promise.all([
      getSpreadsheetInfo(oauth2Client, spreadsheetId),
      getSpreadsheetData(oauth2Client, spreadsheetId, range)
    ]);

    // Save/update sheet record
    await prisma.googleSheet.upsert({
      where: {
        userId_spreadsheetId: {
          userId: authResult.user.userId,
          spreadsheetId: spreadsheetId,
        },
      },
      update: {
        lastUsedAt: new Date(),
        title: spreadsheetInfo.properties!.title!,
        range: range,
      },
      create: {
        userId: authResult.user.userId,
        spreadsheetId: spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        title: spreadsheetInfo.properties!.title!,
        range: range,
        lastUsedAt: new Date(),
      },
    });

    const response: SpreadsheetData = {
      spreadsheet: {
        properties: {
          title: spreadsheetInfo.properties?.title || '',
        },
        sheets: (spreadsheetInfo.sheets || []).map(sheet => ({
          properties: {
            sheetId: sheet.properties?.sheetId ?? 0,
            title: sheet.properties?.title || '',
          }
        })),
      },
      data: data,
      sheets: spreadsheetInfo.sheets?.map(sheet => ({
        id: sheet.properties!.sheetId!,
        title: sheet.properties!.title!,
      })) || []
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get sheet data error:', error);
    return NextResponse.json({ error: 'Failed to fetch sheet data' }, { status: 500 });
  }
}
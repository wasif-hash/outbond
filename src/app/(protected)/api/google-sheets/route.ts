import { NextResponse, NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import { createAuthorizedClient, getUserSpreadsheets, refreshTokenIfNeeded } from '@/lib/google-sheet/google-sheet';
import { GoogleSheetsListResponse } from '@/types/google-sheet';


export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const spreadsheets = await getUserSpreadsheets(oauth2Client);

    // Store/update spreadsheets in database for this user
    for (const spreadsheet of spreadsheets) {
      await prisma.googleSheet.upsert({
        where: { 
          userId_spreadsheetId: {
            userId: authResult.user.userId,
            spreadsheetId: spreadsheet.id
          }
        },
        update: {
          title: spreadsheet.name,
          spreadsheetUrl: spreadsheet.webViewLink,
          lastUsedAt: new Date(),
        },
        create: {
          userId: authResult.user.userId,
          spreadsheetId: spreadsheet.id,
          spreadsheetUrl: spreadsheet.webViewLink,
          title: spreadsheet.name,
          lastUsedAt: new Date(),
        },
      });
    }

    const response: GoogleSheetsListResponse = { spreadsheets };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Get sheets error:', error);
    return NextResponse.json({ error: 'Failed to fetch sheets' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuthorizedClient, refreshTokenIfNeeded } from '@/lib/google-sheet/google-sheet';

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenRecord = await prisma.googleOAuthToken.findUnique({
      where: { userId: user.userId },
    });

    if (!tokenRecord) {
      return NextResponse.json({
        isConnected: false,
        isExpired: false,
        connectedAt: null,
        expiresAt: null,
      });
    }

    let effectiveRecord = tokenRecord;
    const expiresAtMs = tokenRecord.expiresAt ? tokenRecord.expiresAt.getTime() : 0;
    const nowMs = Date.now();
    const shouldRefresh = !expiresAtMs || expiresAtMs - nowMs <= REFRESH_THRESHOLD_MS;

    if (shouldRefresh) {
      try {
        const oauth2Client = await createAuthorizedClient(
          tokenRecord.accessToken,
          tokenRecord.refreshToken,
        );

        await refreshTokenIfNeeded(oauth2Client, tokenRecord, user.userId);

        const updated = await prisma.googleOAuthToken.findUnique({
          where: { userId: user.userId },
        });

        if (updated) {
          effectiveRecord = updated;
        }
      } catch (refreshError) {
        console.error('⚠️ Failed to refresh Google token while checking status:', refreshError);
      }
    }

    const isExpired = effectiveRecord.expiresAt ? new Date() >= effectiveRecord.expiresAt : false;

    return NextResponse.json({
      isConnected: true,
      isExpired,
      connectedAt: effectiveRecord.createdAt || null,
      expiresAt: effectiveRecord.expiresAt || null,
    });
  } catch (error) {
    console.error('Check Google status error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}

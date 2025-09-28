import { NextResponse, NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete Google OAuth tokens to force re-authentication
    await prisma.googleOAuthToken.deleteMany({
      where: { userId: authResult.user.userId },
    });

    // Also clear any stored Google Sheets
    await prisma.googleSheet.deleteMany({
      where: { userId: authResult.user.userId },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Google tokens cleared. Please reconnect your Google account with updated permissions.' 
    });
  } catch (error) {
    console.error('Clear tokens error:', error);
    return NextResponse.json({ error: 'Failed to clear tokens' }, { status: 500 });
  }
}

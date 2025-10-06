import { NextResponse, NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.$transaction([
      prisma.googleSheet.deleteMany({
        where: { userId: authResult.user.userId },
      }),
      prisma.googleOAuthToken.deleteMany({
        where: { userId: authResult.user.userId },
      }),
    ]);

    return NextResponse.json({ success: true, message: 'Google account disconnected' });
  } catch (error) {
    console.error('Disconnect Google error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
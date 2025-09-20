import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenRecord = await prisma.googleOAuthToken.findUnique({
      where: { userId: user.userId },
      select: { id: true, expiresAt: true, createdAt: true }
    });

    const isConnected = !!tokenRecord;
    const isExpired = tokenRecord ? new Date() >= tokenRecord.expiresAt : false;

    return NextResponse.json({
      isConnected,
      isExpired,
      connectedAt: tokenRecord?.createdAt || null,
      expiresAt: tokenRecord?.expiresAt || null,
    });
  } catch (error) {
    console.error('Check Google status error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
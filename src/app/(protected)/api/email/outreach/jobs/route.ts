import { NextRequest, NextResponse } from 'next/server'

import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DEFAULT_LIMIT = 200

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()
  const normalizedQuery = query ? query.toLowerCase() : null
  const limitParam = Number.parseInt(searchParams.get('limit') ?? '', 10)
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : DEFAULT_LIMIT

  const jobs = await prisma.emailSendJob.findMany({
    where: {
      userId: authResult.user.userId,
      ...(normalizedQuery
        ? {
            OR: [
              { leadEmail: { contains: normalizedQuery, mode: 'insensitive' } },
              { leadFirstName: { contains: normalizedQuery, mode: 'insensitive' } },
              { leadLastName: { contains: normalizedQuery, mode: 'insensitive' } },
              { leadCompany: { contains: normalizedQuery, mode: 'insensitive' } },
              { subject: { contains: normalizedQuery, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ jobs })
}

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000
const db = prisma as any

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const account = await db.gmailAccount.findUnique({ where: { userId: user.userId } })

    if (!account) {
      return NextResponse.json({
        isConnected: false,
        emailAddress: null,
        expiresAt: null,
        willRefresh: false,
      })
    }

    const expiresAtMs = account.expiresAt ? new Date(account.expiresAt).getTime() : 0
    const willRefresh = !expiresAtMs || expiresAtMs - Date.now() <= REFRESH_THRESHOLD_MS

    return NextResponse.json({
      isConnected: true,
      emailAddress: account.emailAddress,
      expiresAt: account.expiresAt,
      willRefresh,
    })
  } catch (error) {
    console.error('Gmail status error:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2021') {
        return NextResponse.json(
          { error: 'Gmail tables not found. Run Prisma migrations to create GmailAccount.' },
          { status: 503 }
        )
      }
      if (error.code === 'P2024') {
        return NextResponse.json(
          { error: 'Database connection pool timed out while checking Gmail status. Retry shortly or adjust pool settings.' },
          { status: 503 }
        )
      }
    }
    return NextResponse.json({ error: 'Failed to load gmail status' }, { status: 500 })
  }
}

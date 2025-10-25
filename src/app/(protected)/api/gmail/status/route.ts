import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000
const INACTIVITY_TIMEOUT_MS = 3 * 24 * 60 * 60 * 1000
const TOUCH_INTERVAL_MS = 6 * 60 * 60 * 1000

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const account = await prisma.gmailAccount.findUnique({ where: { userId: user.userId } })

    if (!account || !account.accessToken || !account.refreshToken) {
      return NextResponse.json({
        isConnected: false,
        emailAddress: account?.emailAddress ?? null,
        expiresAt: account?.expiresAt ?? null,
        willRefresh: false,
        requiresReauth: Boolean(account),
      })
    }

    const expiresAtMs = account.expiresAt ? new Date(account.expiresAt).getTime() : 0
    const willRefresh = !expiresAtMs || expiresAtMs - Date.now() <= REFRESH_THRESHOLD_MS
    const lastActiveAt = account.connectedAt ?? account.updatedAt ?? account.createdAt
    const lastActiveMs = lastActiveAt ? new Date(lastActiveAt).getTime() : 0
    const inactiveMs = Date.now() - lastActiveMs

    if (inactiveMs > INACTIVITY_TIMEOUT_MS) {
      return NextResponse.json({
        isConnected: false,
        emailAddress: account.emailAddress,
        expiresAt: account.expiresAt,
        willRefresh: false,
        requiresReauth: true,
        inactiveSince: account.connectedAt,
      })
    }

    if (!account.connectedAt || Date.now() - new Date(account.connectedAt).getTime() >= TOUCH_INTERVAL_MS) {
      try {
        await prisma.gmailAccount.update({
          where: { id: account.id },
          data: { connectedAt: new Date() },
        })
      } catch (touchError) {
        console.warn('Failed to refresh Gmail connection heartbeat', touchError)
      }
    }

    return NextResponse.json({
      isConnected: true,
      emailAddress: account.emailAddress,
      expiresAt: account.expiresAt,
      willRefresh,
      lastActiveAt,
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

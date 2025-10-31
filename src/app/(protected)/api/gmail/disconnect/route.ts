import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function DELETE() {
  const authResult = await verifyAuth()
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.gmailAccount.deleteMany({ where: { userId: authResult.user.userId } })
  } catch (error) {
    console.error('Gmail disconnect error:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return NextResponse.json({ error: 'Gmail tables not found. Run Prisma migrations to create GmailAccount.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Failed to disconnect Gmail account' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

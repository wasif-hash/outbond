import { NextRequest, NextResponse } from "next/server"

import { verifyAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = auth.user.userId
    const afterParam = request.nextUrl.searchParams.get("after")
    const afterNumber = afterParam ? Number(afterParam) : null
    const afterDate =
      afterNumber && Number.isFinite(afterNumber) && afterNumber > 0 ? new Date(afterNumber) : null

    const where = afterDate
      ? {
          userId,
          receivedAt: {
            gt: afterDate,
          },
        }
      : { userId }

    const [unreadCount, latest] = await Promise.all([
      prisma.emailReply.count({
        where,
      }),
      prisma.emailReply.aggregate({
        where: {
          userId,
        },
        _max: {
          receivedAt: true,
        },
      }),
    ])

    return NextResponse.json({
      count: unreadCount,
      latestReceivedAt: latest._max.receivedAt?.toISOString() ?? null,
    })
  } catch (error) {
    console.error("Failed to load unread replies count", error)
    return NextResponse.json({ error: "Failed to load unread count" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"

import { verifyAuth } from "@/lib/auth"
import { triggerReplySync } from "@/lib/replies"

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    triggerReplySync(auth.user.userId)
    return NextResponse.json({ status: "queued" }, { status: 202 })
  } catch (error) {
    console.error("Failed to start replies sync", error)
    return NextResponse.json({ error: "Failed to queue sync" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"

import { verifyAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureCors } from "@/lib/http/cors"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function OPTIONS(request: NextRequest, context: RouteParams) {
  await context.params
  const cors = await ensureCors(request)
  return cors.respond(null, { status: cors.statusCode })
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  const cors = await ensureCors(request)
  if (cors.isPreflight) {
    return cors.respond()
  }

  const { id } = await context.params

  const authResult = await verifyAuth(request)
  if (!authResult.success || !authResult.user) {
    return cors.apply(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const draft = await prisma.manualCampaignDraft.findUnique({ where: { id } })
  if (!draft || draft.userId !== authResult.user.userId) {
    return cors.apply(NextResponse.json({ error: "Draft not found" }, { status: 404 }))
  }

  await prisma.manualCampaignDraft.delete({ where: { id } })

  return cors.apply(NextResponse.json({ success: true }))
}

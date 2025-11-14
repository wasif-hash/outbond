import { NextRequest, NextResponse } from "next/server"
import { Prisma, SavedSnippet as SavedSnippetModel } from "@prisma/client"

import { verifyAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureCors } from "@/lib/http/cors"
import type { SavedSnippetType } from "@/types/saved-snippet"

type SavedSnippetDelegate = Prisma.SavedSnippetDelegate

type UpdatePayload = {
  name?: string
  content?: string
  type?: SavedSnippetType
}

const sanitizeName = (value?: string | null) => {
  const trimmed = value?.trim() ?? ""
  return trimmed.slice(0, 120)
}

const sanitizeContent = (value?: string | null) => {
  const trimmed = value?.trim() ?? ""
  return trimmed.slice(0, 4000)
}

const isValidType = (value?: string | null): value is SavedSnippetType =>
  value === "PROMPT" || value === "SIGNATURE"

type RouteParams = { params: Promise<{ id: string }> }

export async function OPTIONS(request: NextRequest, context: RouteParams) {
  await context.params
  const cors = await ensureCors(request)
  return cors.respond(null, { status: cors.statusCode })
}

export async function PUT(request: NextRequest, context: RouteParams) {
  const cors = await ensureCors(request)
  if (cors.isPreflight) {
    return cors.respond()
  }

  const { id } = await context.params

  const authResult = await verifyAuth(request)
  if (!authResult.success || !authResult.user) {
    return cors.apply(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const delegate = (prisma as typeof prisma & { savedSnippet?: SavedSnippetDelegate }).savedSnippet
  const existing = delegate
    ? await delegate.findUnique({ where: { id } })
    : (
        await prisma.$queryRaw<SavedSnippetModel[]>`
          SELECT "id","userId","name","type","content","createdAt","updatedAt"
          FROM "SavedSnippet"
          WHERE "id" = ${id}
        `
      )[0]

  if (!existing || existing.userId !== authResult.user.userId) {
    return cors.apply(NextResponse.json({ error: "Snippet not found" }, { status: 404 }))
  }

  const payload = (await request.json().catch(() => null)) as UpdatePayload | null
  const name = sanitizeName(payload?.name ?? existing.name)
  const content = sanitizeContent(payload?.content ?? existing.content)
  const type = payload?.type ?? existing.type

  if (!isValidType(type)) {
    return cors.apply(NextResponse.json({ error: "Invalid snippet type" }, { status: 400 }))
  }

  const snippet = delegate
    ? await delegate.update({
        where: { id: existing.id },
        data: {
          name,
          content,
          type,
        },
      })
    : (
        await prisma.$queryRaw<SavedSnippetModel[]>`
          UPDATE "SavedSnippet"
          SET "name" = ${name},
              "content" = ${content},
              "type" = ${type},
              "updatedAt" = NOW()
          WHERE "id" = ${existing.id} AND "userId" = ${authResult.user.userId}
          RETURNING "id","userId","name","type","content","createdAt","updatedAt"
        `
      )[0]

  return cors.apply(NextResponse.json({ snippet }))
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

  const delegate = (prisma as typeof prisma & { savedSnippet?: SavedSnippetDelegate }).savedSnippet
  const existing = delegate
    ? await delegate.findUnique({ where: { id } })
    : (
        await prisma.$queryRaw<SavedSnippetModel[]>`
          SELECT "id","userId","name","type","content","createdAt","updatedAt"
          FROM "SavedSnippet"
          WHERE "id" = ${id}
        `
      )[0]

  if (!existing || existing.userId !== authResult.user.userId) {
    return cors.apply(NextResponse.json({ error: "Snippet not found" }, { status: 404 }))
  }

  if (delegate) {
    await delegate.delete({ where: { id: existing.id } })
  } else {
    await prisma.$executeRaw`
      DELETE FROM "SavedSnippet"
      WHERE "id" = ${existing.id} AND "userId" = ${authResult.user.userId}
    `
  }

  return cors.apply(NextResponse.json({ success: true }))
}

import { NextRequest, NextResponse } from "next/server"
import { Prisma, SavedSnippet as SavedSnippetModel } from "@prisma/client"
import { createHash } from "crypto"

import { verifyAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureCors } from "@/lib/http/cors"
import type { SavedSnippetType } from "@/types/saved-snippet"

type SavedSnippetDelegate = Prisma.SavedSnippetDelegate

type CreatePayload = {
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

export async function OPTIONS(request: NextRequest) {
  const cors = await ensureCors(request)
  return cors.respond(null, { status: cors.statusCode })
}

export async function GET(request: NextRequest) {
  const cors = await ensureCors(request)
  if (cors.isPreflight) {
    return cors.respond()
  }

  const authResult = await verifyAuth(request)
  if (!authResult.success || !authResult.user) {
    return cors.apply(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const { searchParams } = new URL(request.url)
  const typeParam = searchParams.get("type")
  const filters: { type?: SavedSnippetType } = {}
  if (typeParam && isValidType(typeParam)) {
    filters.type = typeParam
  }

  const delegate = (prisma as typeof prisma & { savedSnippet?: SavedSnippetDelegate }).savedSnippet
  const baseWhere = { userId: authResult.user.userId, ...filters }

  const ifNoneMatch = request.headers.get("if-none-match")
  let etag: string | null = null
  let latestUpdate: Date | null = null
  let totalItems: number | null = null

  if (ifNoneMatch) {
    const aggregateResult = delegate
      ? await delegate.aggregate({
          where: baseWhere,
          _count: { _all: true },
          _max: { updatedAt: true },
        })
      : (
          await prisma.$queryRaw<{ count: number; latest: Date | null }[]>`
            SELECT COUNT(*)::int as "count", MAX("updatedAt") as "latest"
            FROM "SavedSnippet"
            WHERE "userId" = ${authResult.user.userId}
            ${filters.type ? Prisma.sql`AND "type" = ${filters.type}` : Prisma.sql``}
          `
        )[0] ?? { count: 0, latest: null }

    totalItems = delegate ? aggregateResult._count._all : aggregateResult.count
    latestUpdate =
      delegate ? aggregateResult._max.updatedAt ?? null : (aggregateResult as { latest: Date | null }).latest
    const latestStamp = latestUpdate ? latestUpdate.getTime() : 0
    const etagSeed = `${authResult.user.userId}:${filters.type ?? "ALL"}:${totalItems}:${latestStamp}`
    etag = `"${createHash("sha1").update(etagSeed).digest("hex")}"`

    if (ifNoneMatch === etag) {
      const notModified = new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "private, max-age=30",
          ...(latestUpdate ? { "Last-Modified": latestUpdate.toUTCString() } : {}),
        },
      })

      return cors.apply(notModified)
    }
  }

  const snippets = delegate
    ? await delegate.findMany({
        where: baseWhere,
        orderBy: { updatedAt: "desc" },
      })
    : await prisma.$queryRaw<SavedSnippetModel[]>`
        SELECT "id","userId","name","type","content","createdAt","updatedAt"
        FROM "SavedSnippet"
        WHERE "userId" = ${authResult.user.userId}
        ${filters.type ? Prisma.sql`AND "type" = ${filters.type}` : Prisma.sql``}
        ORDER BY "updatedAt" DESC
      `

  if (!etag) {
    totalItems = snippets.length
    latestUpdate = snippets.reduce<Date | null>((current, item) => {
      const timestamp = item.updatedAt ?? item.createdAt
      if (!timestamp) {
        return current
      }

      if (!current || timestamp > current) {
        return timestamp
      }
      return current
    }, null)
    const latestStamp = latestUpdate ? latestUpdate.getTime() : 0
    const etagSeed = `${authResult.user.userId}:${filters.type ?? "ALL"}:${totalItems}:${latestStamp}`
    etag = `"${createHash("sha1").update(etagSeed).digest("hex")}"`
  }

  const response = NextResponse.json({ snippets })
  response.headers.set("ETag", etag!)
  response.headers.set("Cache-Control", "private, max-age=30")
  if (latestUpdate) {
    response.headers.set("Last-Modified", latestUpdate.toUTCString())
  }

  return cors.apply(response)
}

export async function POST(request: NextRequest) {
  const cors = await ensureCors(request)
  if (cors.isPreflight) {
    return cors.respond()
  }

  const authResult = await verifyAuth(request)
  if (!authResult.success || !authResult.user) {
    return cors.apply(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const payload = (await request.json().catch(() => null)) as CreatePayload | null
  const name = sanitizeName(payload?.name)
  const content = sanitizeContent(payload?.content)
  const type = payload?.type

  if (!name) {
    return cors.apply(NextResponse.json({ error: "Name is required" }, { status: 400 }))
  }
  if (!content) {
    return cors.apply(NextResponse.json({ error: "Content is required" }, { status: 400 }))
  }
  if (!isValidType(type)) {
    return cors.apply(NextResponse.json({ error: "Invalid snippet type" }, { status: 400 }))
  }

  const delegate = (prisma as typeof prisma & { savedSnippet?: SavedSnippetDelegate }).savedSnippet
  const snippet = delegate
    ? await delegate.create({
        data: {
          userId: authResult.user.userId,
          name,
          content,
          type,
        },
      })
    : (
        await prisma.$queryRaw<SavedSnippetModel[]>`
          INSERT INTO "SavedSnippet" ("userId","name","type","content","createdAt","updatedAt")
          VALUES (${authResult.user.userId}, ${name}, ${type}, ${content}, NOW(), NOW())
          RETURNING "id","userId","name","type","content","createdAt","updatedAt"
        `
      )[0]

  return cors.apply(NextResponse.json({ snippet }))
}

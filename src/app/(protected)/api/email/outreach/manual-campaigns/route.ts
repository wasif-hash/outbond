import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import type { ManualCampaignDraft as ManualCampaignDraftModel, Prisma } from "@prisma/client"

import { verifyAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type {
  ManualCampaignDraft,
  ManualCampaignDraftStatus,
  PersistedWorkflowState,
} from "@/types/outreach-workflow"
import type { ManualOutreachSource } from "@/types/outreach"
import { ensureCors } from "@/lib/http/cors"

type SaveDraftPayload = {
  id?: string | null
  name?: string | null
  status?: ManualCampaignDraftStatus | null
  sourceType?: ManualOutreachSource | null
  state?: PersistedWorkflowState | null
}

const DEFAULT_STATUS: ManualCampaignDraftStatus = "draft"
const STATUS_VALUES: ManualCampaignDraftStatus[] = ["draft", "queued", "sent"]

const normalizeName = (value?: string | null) => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : "Untitled Outreach"
}

const normalizeStatus = (value?: ManualCampaignDraftStatus | null): ManualCampaignDraftStatus => {
  if (!value) return DEFAULT_STATUS
  return STATUS_VALUES.includes(value) ? value : DEFAULT_STATUS
}

const serializeDraft = (draft: ManualCampaignDraftModel): ManualCampaignDraft => {
  const rawState = (draft.workflowState ?? null) as PersistedWorkflowState | null
  const workflowState: PersistedWorkflowState = rawState
    ? { ...rawState, manualCampaignId: draft.id }
    : {
        campaignName: draft.name,
        manualCampaignId: draft.id,
        sourceType: (draft.sourceType as ManualOutreachSource | null) ?? null,
        currentStep: 1,
        selectedSheetId: "",
        sheetRange: "",
        leads: [],
        promptInput: "",
        chatMessages: [],
        drafts: {},
        sendingMode: "single",
        uploadedFileMeta: null,
        lastUpdated: Date.now(),
      }

  return {
    id: draft.id,
    name: draft.name,
    sourceType: (draft.sourceType as ManualOutreachSource | null) ?? null,
    status: normalizeStatus(draft.status as ManualCampaignDraftStatus),
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    workflowState,
  }
}

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

  const drafts = await prisma.manualCampaignDraft.findMany({
    where: { userId: authResult.user.userId },
    orderBy: { updatedAt: "desc" },
  })

  return cors.apply(NextResponse.json({ drafts: drafts.map(serializeDraft) }))
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

  const payload = (await request.json().catch(() => null)) as SaveDraftPayload | null

  if (!payload?.state || typeof payload.state !== "object") {
    return cors.apply(NextResponse.json({ error: "A full outreach workflow state is required" }, { status: 400 }))
  }

  const name = normalizeName(payload.name ?? payload.state.campaignName)
  const status = normalizeStatus(payload.status)
  const sourceType = payload.sourceType ?? payload.state.sourceType ?? null
  const requestedId = payload.id?.trim() || payload.state.manualCampaignId?.trim() || null

  let existing: ManualCampaignDraftModel | null = null
  if (requestedId) {
    existing = await prisma.manualCampaignDraft.findUnique({ where: { id: requestedId } })
    if (existing && existing.userId !== authResult.user.userId) {
      return cors.apply(NextResponse.json({ error: "Draft not found" }, { status: 404 }))
    }
  }

  const draftId = existing?.id ?? requestedId ?? randomUUID()
  const stateToPersist: PersistedWorkflowState = {
    ...payload.state,
    manualCampaignId: draftId,
    sourceType,
    lastUpdated: Date.now(),
  }

  const data = {
    name,
    status,
    sourceType,
    workflowState: stateToPersist as Prisma.JsonObject,
  }

  const draft = existing
    ? await prisma.manualCampaignDraft.update({
        where: { id: draftId },
        data,
      })
    : await prisma.manualCampaignDraft.create({
        data: {
          ...data,
          id: draftId,
          userId: authResult.user.userId,
        },
      })

  return cors.apply(NextResponse.json({ draft: serializeDraft(draft) }))
}

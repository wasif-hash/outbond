'use server'

import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import type { ManualCampaignDraft, ManualCampaignDraftStatus, PersistedWorkflowState } from '@/types/outreach-workflow'
import type { ManualCampaignDraft as PrismaManualCampaignDraft } from '@prisma/client'

export type PersistDraftInput = {
  id: string | null
  name: string
  sourceType: string | null
  status: ManualCampaignDraftStatus
  state: PersistedWorkflowState
}

const serializeDraft = (draft: PrismaManualCampaignDraft): ManualCampaignDraft => ({
  id: draft.id,
  name: draft.name,
  sourceType: draft.sourceType as ManualCampaignDraft['sourceType'],
  status: draft.status as ManualCampaignDraftStatus,
  createdAt: draft.createdAt.toISOString(),
  updatedAt: draft.updatedAt.toISOString(),
  workflowState: draft.workflowState as PersistedWorkflowState,
})

/**
 * Creates or updates a manual outreach campaign draft in the database.
 * Called from the outreach wizard to autosave and explicitly save drafts.
 */
export async function persistManualCampaignDraftAction(input: PersistDraftInput): Promise<ManualCampaignDraft> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('You must be signed in to save drafts.')
  }

  const payload = {
    userId: user.userId,
    name: input.name || 'Untitled Outreach',
    sourceType: input.sourceType,
    status: input.status,
    workflowState: input.state,
  }

  let saved
  if (input.id) {
    const existing = await prisma.manualCampaignDraft.findUnique({ where: { id: input.id } })
    if (existing) {
      if (existing.userId !== user.userId) {
        throw new Error('Draft not found')
      }
      saved = await prisma.manualCampaignDraft.update({ where: { id: input.id }, data: payload })
    } else {
      saved = await prisma.manualCampaignDraft.create({ data: { ...payload, id: input.id } })
    }
  } else {
    saved = await prisma.manualCampaignDraft.create({ data: payload })
  }

  revalidatePath('/dashboard/outreach')
  return serializeDraft(saved)
}

/**
 * Lists the current user's manual campaign drafts.
 */
export async function getManualCampaignDraftsAction(): Promise<ManualCampaignDraft[]> {
  const user = await getCurrentUser()
  if (!user) {
    return []
  }

  const drafts = await prisma.manualCampaignDraft.findMany({
    where: { userId: user.userId },
    orderBy: { updatedAt: 'desc' },
  })

  return drafts.map(serializeDraft)
}

/**
 * Deletes the specified manual campaign draft (if owned by the current user).
 */
export async function deleteManualCampaignDraftAction(id: string): Promise<{ success: boolean }> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('You must be signed in to delete drafts.')
  }

  await prisma.manualCampaignDraft.deleteMany({
    where: {
      id,
      userId: user.userId,
    },
  })

  revalidatePath('/dashboard/outreach')
  return { success: true }
}

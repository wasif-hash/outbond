'use server'

import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import type { SavedSnippet, SavedSnippetType } from '@/types/saved-snippet'

const mapSnippet = (snippet: { id: string; userId: string; name: string; type: SavedSnippetType; content: string; createdAt: Date; updatedAt: Date }): SavedSnippet => ({
  id: snippet.id,
  userId: snippet.userId,
  name: snippet.name,
  type: snippet.type,
  content: snippet.content,
  createdAt: snippet.createdAt.toISOString(),
  updatedAt: snippet.updatedAt.toISOString(),
})

/**
 * Returns all saved snippets belonging to the authenticated user.
 * Used by both the Saved page (server component) and the outreach workflow (client hook).
 */
export async function getSavedSnippetsAction(): Promise<SavedSnippet[]> {
  const user = await getCurrentUser()
  if (!user) {
    return []
  }

  const snippets = await prisma.savedSnippet.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
  })

  return snippets.map(mapSnippet)
}

type CreateSnippetInput = {
  name: string
  content: string
  type: SavedSnippetType
}

/**
 * Creates a new saved snippet (prompt or signature) for the current user.
 * Called from the Saved page client component and the outreach workflow when saving a prompt.
 */
export async function createSavedSnippetAction(input: CreateSnippetInput): Promise<SavedSnippet> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('You must be signed in to save snippets.')
  }

  const trimmedName = input.name.trim()
  const trimmedContent = input.content.trim()

  if (!trimmedName || !trimmedContent) {
    throw new Error('Snippet name and content are required.')
  }

  const snippet = await prisma.savedSnippet.create({
    data: {
      userId: user.userId,
      name: trimmedName,
      content: trimmedContent,
      type: input.type,
    },
  })

  revalidatePath('/dashboard/saved')
  return mapSnippet(snippet)
}

/**
 * Deletes a saved snippet owned by the current user.
 * Used by the Saved page.
 */
export async function deleteSavedSnippetAction(id: string): Promise<{ success: boolean }> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('You must be signed in to delete snippets.')
  }

  await prisma.savedSnippet.deleteMany({
    where: {
      id,
      userId: user.userId,
    },
  })

  revalidatePath('/dashboard/saved')
  return { success: true }
}

'use server'

import { cookies } from 'next/headers'
import axios from 'axios'

import { getApiClient } from '@/lib/http-client'

export type CreateCampaignPayload = {
  name: string
  jobTitles: string[]
  locations: string[]
  keywords: string
  maxLeads: number
  pageSize: number
  searchMode: 'balanced' | 'conserve'
  googleSheetId: string
  includeDomains?: string
  excludeDomains?: string
}

/**
 * Server action that creates a campaign for the dashboard CreateCampaignForm.
 * It forwards the authenticated cookies and calls `/api/campaigns` on the server
 * so the client component never performs the network request directly.
 */
export async function createCampaignAction(payload: CreateCampaignPayload) {
  const client = getApiClient()
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join('; ')

  try {
    const { data } = await client.post('/api/campaigns', payload, {
      headers: {
        'cache-control': 'no-store',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    })

    return data
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? ((error.response?.data as { error?: string })?.error ?? error.message)
      : error instanceof Error
        ? error.message
        : 'Failed to create campaign'
    throw new Error(message)
  }
}

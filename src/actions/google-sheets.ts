'use server'

import { cookies } from 'next/headers'

import { getApiClient } from '@/lib/http-client'

export type GoogleSheetsIntegrationStatus = {
  isConnected: boolean
  isExpired: boolean
  connectedAt: string | null
  expiresAt: string | null
}

export async function getGoogleSheetsStatus(): Promise<GoogleSheetsIntegrationStatus | null> {
  const client = getApiClient()
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join('; ')

  const { data } = await client.get<GoogleSheetsIntegrationStatus>('/api/google-sheets/status', {
    headers: {
      'cache-control': 'no-store',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  })
  return data ?? null
}

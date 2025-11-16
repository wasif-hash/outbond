'use server'

import { cookies } from 'next/headers'

import { getApiClient } from '@/lib/http-client'
import type { DashboardAnalyticsResponse } from '@/types/dashboard'

export async function getDashboardAnalytics(): Promise<DashboardAnalyticsResponse> {
  const client = getApiClient()
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join('; ')

  const { data } = await client.get<DashboardAnalyticsResponse>('/api/dashboard/analytics', {
    headers: {
      'cache-control': 'no-store',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  })
  return data
}

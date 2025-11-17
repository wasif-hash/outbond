'use server'

import { cookies } from 'next/headers'

import { getApiClient } from '@/lib/http-client'
import type { OutreachedJob } from '@/types/outreach'

const buildCookieHeader = async () =>
  (await cookies()).getAll().map(({ name, value }) => `${name}=${value}`).join('; ')

export async function getOutreachedJobsAction(): Promise<OutreachedJob[]> {
  const client = getApiClient()
  const cookieHeader = await buildCookieHeader()
  const { data } = await client.get<{ jobs: OutreachedJob[] }>('/api/email/outreach/jobs', {
    headers: {
      'cache-control': 'no-store',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  })
  return data.jobs ?? []
}

export async function sendBulkEmailsAction(payload: { jobs: Array<{ leadEmail: string }> }) {
  const client = getApiClient()
  const cookieHeader = await buildCookieHeader()
  await client.post('/api/email/outreach/send', payload, {
    headers: {
      'cache-control': 'no-store',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  })
  return { success: true }
}

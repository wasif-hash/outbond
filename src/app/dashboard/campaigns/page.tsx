// src/app/dashboard/campaigns/page.tsx
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { getCampaignsForUser } from '@/lib/campaigns'

import { CampaignsClient } from './campaigns-client'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const initialData = await getCampaignsForUser(user.userId)

  return <CampaignsClient initialData={initialData} />
}

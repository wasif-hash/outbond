// src/app/dashboard/campaigns/page.tsx
import { Suspense } from 'react'
import { unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { getCampaignsForUser } from '@/lib/apollo/campaigns'

import { CampaignsClient } from './campaigns-client'
import { CampaignsSkeleton } from './campaigns-skeleton'

export const dynamic = 'force-dynamic'

const createCampaignsCache = (userId: string) =>
  unstable_cache(
    () => getCampaignsForUser(userId),
    ['campaigns-for-user', userId],
    {
      revalidate: 10,
      tags: [`user-campaigns:${userId}`],
    }
  )

async function CampaignsContent({ userId }: { userId: string }) {
  const readCampaigns = createCampaignsCache(userId)
  const initialData = await readCampaigns()

  return <CampaignsClient initialData={initialData} />
}

export default async function CampaignsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <Suspense fallback={<CampaignsSkeleton />}>
      <CampaignsContent userId={user.userId} />
    </Suspense>
  )
}

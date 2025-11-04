import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'

import { AccountSettingsClient } from './account-settings-client'

export const dynamic = 'force-dynamic'

export default async function AccountSettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return <AccountSettingsClient user={user} />
}

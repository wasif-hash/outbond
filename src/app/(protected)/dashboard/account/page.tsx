import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { getGoogleSheetsStatus } from '@/actions/google-sheets'

import { AccountSettingsClient } from './account-settings-client'

export const dynamic = 'force-dynamic'

export default async function AccountSettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const googleSheetsStatus = await getGoogleSheetsStatus()

  return <AccountSettingsClient user={user} googleSheetsStatus={googleSheetsStatus} />
}

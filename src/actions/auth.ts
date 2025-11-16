'use server'

import { cookies } from 'next/headers'
import axios from 'axios'

import { getApiClient } from '@/lib/http-client'

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

/**
 * Handles password update submissions coming from the Account Settings page.
 * The AccountSettingsClient form calls this action so it can forward the user's
 * session cookies and perform the `/api/account/password` request entirely on the server.
 */
export async function changePasswordAction(payload: ChangePasswordPayload) {
  const client = getApiClient()
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join('; ')

  try {
    const { data } = await client.patch<{ message?: string }>(
      '/api/account/password',
      payload,
      {
        headers: {
          'cache-control': 'no-store',
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
      },
    )

    return {
      success: true,
      message: data?.message ?? 'Password updated successfully.',
    }
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? ((error.response?.data as { error?: string })?.error ?? error.message)
      : error instanceof Error
        ? error.message
        : 'Unable to update password.'
    throw new Error(message)
  }
}

import { NextRequest, NextResponse } from 'next/server'

import { updateCurrentUserPassword } from '@/actions/user-actions'
import { verifyAuth } from '@/lib/auth'

const resolveClientIdentifier = (request: NextRequest): string =>
  request.ip ||
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  'unknown'

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { currentPassword, newPassword, confirmPassword } = await request.json()

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'All password fields are required' },
        { status: 400 }
      )
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'New passwords do not match' },
        { status: 400 }
      )
    }

    const clientIdentifier = resolveClientIdentifier(request)
    const result = await updateCurrentUserPassword(
      authResult.user.userId,
      currentPassword,
      newPassword,
      {
        requesterId: authResult.user.userId,
        requesterEmail: authResult.user.email,
        requesterIp: clientIdentifier
      }
    )

    if (!result.success) {
      const status =
        result.error === 'RATE_LIMIT_EXCEEDED'
          ? 429
          : result.error === 'INVALID_CREDENTIALS'
            ? 401
            : result.error === 'WEAK_PASSWORD'
              ? 400
              : 400

      const response = NextResponse.json(
        { error: result.message },
        { status }
      )

      if (status === 429 && result.retryAfterSeconds) {
        response.headers.set('Retry-After', String(result.retryAfterSeconds))
      }

      return response
    }

    return NextResponse.json({
      success: true,
      message: result.message
    })
  } catch (error) {
    console.error('Update password API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// app/api/invite-users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { createInvitedUser } from '@/actions/user-actions'

const resolveClientIdentifier = (request: NextRequest): string =>
  request.ip ||
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  'unknown'

export async function POST(request: NextRequest) {
  try {

    const authResult = await verifyAuth(request)
    if (!authResult.success || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const clientIdentifier = resolveClientIdentifier(request)

    // Create invited user (default role = user)
    const result = await createInvitedUser(
      { email, password, role: 'user' },
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
          : result.error === 'USER_EXISTS'
          ? 409
          : 400

      const response = NextResponse.json({ error: result.message }, { status })

      if (status === 429 && result.retryAfterSeconds) {
        response.headers.set('Retry-After', String(result.retryAfterSeconds))
      }

      return response
    }

    return NextResponse.json({
      success: true,
      message: 'User invited successfully',
      user: result.user
    }, { status: 201 })

  } catch (error) {
    console.error('Invite user API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

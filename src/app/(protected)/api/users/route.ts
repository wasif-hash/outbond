import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, createInvitedUser } from '@/actions/user-actions'
import { verifyAuth } from '@/lib/auth'

const resolveClientIdentifier = (request: NextRequest): string => {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp

  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp

  return 'unknown'
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const result = await getAllUsers()
    if (!result.success) {
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    return NextResponse.json({ success: true, users: result.users })
  } catch (error) {
    console.error('Get users API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { email, password, role } = await request.json()
    const clientIdentifier = resolveClientIdentifier(request)
    const result = await createInvitedUser(
      { email, password, role },
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

    return NextResponse.json(
      { success: true, message: result.message, user: result.user },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create user API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

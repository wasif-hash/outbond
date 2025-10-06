// app/api/invite-users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { createInvitedUser } from '@/actions/user-actions'

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

    // Create invited user (default role = user)
    const result = await createInvitedUser({ email, password, role: 'user' })

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
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

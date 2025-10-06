import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, createInvitedUser } from '@/actions/user-actions'
import { verifyAuth } from '@/lib/auth'


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
    const result = await createInvitedUser({ email, password, role })

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
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

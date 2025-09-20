import { NextResponse } from 'next/server'
import { initializeMainAdmin } from '@/actions/user-actions'

export async function POST() {
  try {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_ADMIN_INIT) {
      return NextResponse.json(
        { error: 'Admin initialization not allowed in production' },
        { status: 403 }
      )
    }

    const result = await initializeMainAdmin()

    return NextResponse.json({
      success: result.success,
      message: result.message,
      user: result.user
    })
  } catch (error) {
    console.error('Initialize admin API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

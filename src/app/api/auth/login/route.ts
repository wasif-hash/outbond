import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/actions/user-actions'
import { cookies } from 'next/headers'
import { SignJWT } from 'jose'

// Secret key for JWT
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    const authResult = await authenticateUser(email, password)

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    // Create JWT
    const token = await new SignJWT({
      userId: authResult.user.id,
      email: authResult.user.email,
      role: authResult.user.role
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .setIssuedAt()
      .sign(JWT_SECRET)

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24
    })

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      role: authResult.user.role,
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        role: authResult.user.role
      }
    })
  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/actions/user-actions'
import { SignJWT } from 'jose'

// Secret key for JWT
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

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

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    const clientIdentifier = resolveClientIdentifier(request)
    const authResult = await authenticateUser(
      email,
      password,
      {
        requesterIp: clientIdentifier
      }
    )

    if (!authResult.success || !authResult.user) {
      const status = authResult.error === 'RATE_LIMIT_EXCEEDED' ? 429 : 401
      const response = NextResponse.json({ error: authResult.message }, { status })

      if (status === 429 && authResult.retryAfterSeconds) {
        response.headers.set('Retry-After', String(authResult.retryAfterSeconds))
      }

      return response
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

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      role: authResult.user.role,
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        role: authResult.user.role
      }
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24
    })

    return response
  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

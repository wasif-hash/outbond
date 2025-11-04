import { NextRequest, NextResponse } from 'next/server'
import { initializeMainAdmin } from '@/actions/user-actions'

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
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_ADMIN_INIT) {
      return NextResponse.json(
        { error: 'Admin initialization not allowed in production' },
        { status: 403 }
      )
    }

    const clientIdentifier = resolveClientIdentifier(request)
    const result = await initializeMainAdmin({ requesterIp: clientIdentifier })

    if (!result.success) {
      const status =
        result.error === 'RATE_LIMIT_EXCEEDED'
          ? 429
          : result.error === 'CONFIG_ERROR'
          ? 400
          : 500

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
      success: result.success,
      message: result.message,
      user: result.user
    })
  } catch (error) {
    console.error('Initialize admin API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

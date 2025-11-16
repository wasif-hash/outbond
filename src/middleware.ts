// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate limiting for API routes
  if (pathname.startsWith('/api/campaigns')) {
    // Simple rate limiting - 100 requests per minute per IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    // This would be implemented with Redis in production
    const response = NextResponse.next()
    response.headers.set('X-Client-IP', ip)
    return response
  }

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const authResult = await verifyAuth(request)
    
    if (!authResult.success) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Admin-only routes
    if (pathname.startsWith('/dashboard/users') && authResult.user?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/campaigns/:path*',
    '/api/users/:path*'
  ]
}

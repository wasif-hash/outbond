import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production')

// Define protected routes
const protectedRoutes = ['/dashboard']
const adminOnlyRoutes = ['/dashboard/users', '/dashboard/settings']
const publicRoutes = ['/', '/api/login', '/api/init-admin']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAdminOnlyRoute = adminOnlyRoutes.some(route => pathname.startsWith(route))

  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  // Get authentication token
  const token = request.cookies.get('auth-token')?.value

  if (!token) {
    // Redirect to login if no token
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    // Verify the token
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const userRole = payload.role as string

    // Check admin access for admin-only routes
    if (isAdminOnlyRoute && userRole !== 'admin') {
      // Redirect to dashboard with error
      const url = new URL('/dashboard', request.url)
      url.searchParams.set('error', 'insufficient_permissions')
      return NextResponse.redirect(url)
    }

    // Allow access
    return NextResponse.next()

  } catch (error) {
    console.error('Token verification failed in middleware:', error)
    // Redirect to login if token is invalid
    return NextResponse.redirect(new URL('/', request.url))
  }
}
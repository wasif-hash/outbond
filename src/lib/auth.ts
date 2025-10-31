// lib/auth.ts
import type { User } from '@prisma/client'
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

import { prisma } from './prisma'

const rawJwtSecret = process.env.JWT_SECRET

if (!rawJwtSecret) {
  throw new Error('JWT_SECRET environment variable is required but was not provided.')
}

const JWT_SECRET = new TextEncoder().encode(rawJwtSecret)
export type JWTPayload = { sub: string }

export interface AuthUser {
  userId: string
  email: string
  role: string
}

export interface AuthResult {
  success: boolean
  user?: AuthUser
  error?: string
}


export async function verifyAuth(request?: NextRequest): Promise<AuthResult> {
  try {
    let token: string | undefined

    if (request) {
      token = request.cookies.get('auth-token')?.value || undefined
    } else {
      const cookieStore = await cookies()
      token = cookieStore.get('auth-token')?.value
    }

    if (!token) {
      return {
        success: false,
        error: 'No authentication token found'
      }
    }


    const { payload } = await jwtVerify(token, JWT_SECRET)

    const user: AuthUser = {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string
    }

    return {
      success: true,
      user
    }

  } catch (error) {
    console.error('Token verification failed:', error)
    return {
      success: false,
      error: 'Invalid or expired token'
    }
  }
}

/**
 * Get current user from cookies (for server components)
 * Returns null if no valid authentication found
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return null
    }

    const { payload } = await jwtVerify(token, JWT_SECRET)

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string
    }

  } catch (error) {
    console.error('Failed to get current user:', error)
    return null
  }
}

/**
 * Check if user is admin
 * Used in server components for role-based access control
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === 'admin'
}



export async function getUserFromBearer(req: Request): Promise<User | null> {
  const auth = req.headers.get("authorization") || ""
  if (!auth.toLowerCase().startsWith("bearer ")) return null
  const token = auth.slice(7)
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const userId = typeof payload.sub === 'string' ? payload.sub : undefined
    if (!userId) {
      return null
    }
    const user = await prisma.user.findUnique({ where: { id: userId } })
    return user
  } catch {
    return null
  }
}

export function requireAdmin(
  handler: (req: Request, ctx: Record<string, unknown>, user: User) => Promise<Response>,
) {
  return async (req: Request, ctx: Record<string, unknown>) => {
    const user = await getUserFromBearer(req)
    if (!user || user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { "Content-Type": "application/json" }
      })
    }
    return handler(req, ctx, user)
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

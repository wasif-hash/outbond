import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

import { verifyAuth } from '@/lib/auth'
import { createGmailOAuthClient, GMAIL_SCOPES } from '@/lib/google-gmail'

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nonce = crypto.randomBytes(16).toString('hex')
  const jwtSecret = process.env.JWT_SECRET

  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required for Gmail OAuth state signing')
  }

  const state = jwt.sign({ userId: authResult.user.userId, n: nonce }, jwtSecret, {
    expiresIn: '15m',
  })

  ;(await cookies()).set('gmail_oauth_nonce', nonce, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 900,
  })

  const oauth2Client = createGmailOAuthClient()
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state,
  })

  return NextResponse.json({ authUrl })
}

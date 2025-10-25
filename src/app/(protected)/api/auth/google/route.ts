import { NextResponse, NextRequest } from 'next/server'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

import { newOAuth2Client } from '@/lib/google-sheet/google-auth'
import { verifyAuth } from '@/lib/auth'
import { GoogleAuthResponse } from '@/types/google-sheet'

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
]

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is missing')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const nonce = crypto.randomBytes(8).toString('hex')
    const statePayload = { userId: authResult.user.userId, n: nonce }
    const state = jwt.sign(statePayload, jwtSecret, { expiresIn: '15m' })

    const oauth2Client = newOAuth2Client()
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
      prompt: 'consent',
      state,
    })

    const response = NextResponse.json<GoogleAuthResponse>({ authUrl })
    response.cookies.set('google_oauth_nonce', nonce, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 900, // 15 minutes
    })

    return response
  } catch (error) {
    console.error('Google auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

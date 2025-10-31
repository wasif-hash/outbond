import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { google } from 'googleapis'

import { prisma } from '@/lib/prisma'
import { createGmailOAuthClient } from '@/lib/google-gmail'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const nonceCookie = request.cookies.get('gmail_oauth_nonce')?.value

    if (error) {
      console.error('Gmail OAuth error:', error)
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard/settings?error=gmail_access_denied`)
    }

    if (!code || !state || !nonceCookie) {
      console.error('Missing parameters in Gmail OAuth callback')
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard/settings?error=gmail_invalid_request`)
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required for Gmail OAuth callback')
    }

    let decoded: jwt.JwtPayload
    try {
      decoded = jwt.verify(state, jwtSecret) as jwt.JwtPayload
    } catch (verificationError) {
      console.error('Failed to verify Gmail OAuth state:', verificationError)
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard/settings?error=gmail_invalid_state`)
    }

    if (decoded.n !== nonceCookie) {
      console.error('Gmail OAuth nonce mismatch detected')
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard/settings?error=gmail_nonce_mismatch`)
    }

    const userId = typeof decoded.userId === 'string' ? decoded.userId : null
    if (!userId) {
      console.error('Gmail OAuth callback missing user id in state')
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard/settings?error=gmail_invalid_user`)
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      console.error('User not found for Gmail OAuth callback:', userId)
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/login?error=user_not_found`)
    }

    const oauth2Client = createGmailOAuthClient()
    const tokenResponse = await oauth2Client.getToken(code)
    const tokens = tokenResponse.tokens

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('Invalid Gmail tokens received')
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard/settings?error=gmail_invalid_tokens`)
    }

    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const profileResponse = await gmail.users.getProfile({ userId: 'me' })
    const emailAddress = profileResponse.data.emailAddress

    if (!emailAddress) {
      console.error('Unable to determine Gmail address for user', userId)
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard/settings?error=gmail_missing_address`)
    }

    const now = new Date()
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 55 * 60 * 1000)

    const existingAccount = await prisma.gmailAccount.findUnique({
      where: { userId },
    })
    const existingByEmail = await prisma.gmailAccount.findUnique({
      where: { emailAddress },
    })

    const baseData = {
      emailAddress,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      tokenType: tokens.token_type || 'Bearer',
      scope: tokens.scope || '',
      connectedAt: now,
    }

    if (existingAccount) {
      await prisma.gmailAccount.update({
        where: { userId },
        data: baseData,
      })
    } else if (existingByEmail) {
      if (existingByEmail.userId !== userId) {
        console.warn(
          `Gmail account ${emailAddress} was previously linked to user ${existingByEmail.userId}, reassigning to ${userId}`,
        )
      }
      await prisma.gmailAccount.update({
        where: { emailAddress },
        data: {
          ...baseData,
          userId,
        },
      })
    } else {
      await prisma.gmailAccount.create({
        data: {
          ...baseData,
          userId,
        },
      })
    }

    const response = NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard/settings?success=gmail_connected`)
    response.cookies.set('gmail_oauth_nonce', '', { maxAge: 0, path: '/', httpOnly: true, sameSite: 'lax' })
    return response
  } catch (error) {
    console.error('Gmail OAuth callback error:', error)
    return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard/settings?error=gmail_callback_failed`)
  }
}

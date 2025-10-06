// app/api/auth/google/authorize/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import { newOAuth2Client } from "@/lib/google-sheet/google-auth"
import { requireAdmin } from "@/lib/auth"

export const POST = requireAdmin(async (_req, _ctx, user) => {
  const nonce = crypto.randomBytes(8).toString("hex")
  const jwtSecret = process.env.JWT_SECRET

  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required for Google OAuth state signing')
  }

  const state = jwt.sign({ userId: user.id, n: nonce }, jwtSecret, { expiresIn: "15m" })
  ;(await cookies()).set("google_oauth_nonce", nonce, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 900 })

  const oauth2 = newOAuth2Client()
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: process.env.GOOGLE_SCOPES!.split(" "),
    state
  })
  return NextResponse.json({ authUrl })
})

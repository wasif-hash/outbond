import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { newOAuth2Client } from '@/lib/google-sheet/google-auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard?error=access_denied`);
    }

    if (!code) {
      console.error('No authorization code received');
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard?error=no_code`);
    }

    if (!state) {
      console.error('No state parameter received');
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard?error=no_state`);
    }

    // Decode user info from state parameter
    let user;
    try {
      const decodedState = Buffer.from(state, 'base64').toString('utf-8');
      user = JSON.parse(decodedState);
      console.log('User from state:', user);
    } catch (stateError) {
      console.error('Failed to decode state parameter:', stateError);
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard?error=invalid_state`);
    }

    if (!user || !user.userId) {
      console.error('Invalid user data in state');
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard?error=invalid_user_state`);
    }

    // Verify user still exists in database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, email: true, role: true }
    });

    if (!dbUser) {
      console.error('User not found in database:', user.userId);
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/login?error=user_not_found`);
    }

    console.log('User verified in database:', dbUser);

    const oauth2Client = newOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('Invalid tokens received from Google');
      return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard?error=invalid_tokens`);
    }

    console.log('Saving Google tokens for user:', user.userId);

    // Save tokens to database
    await prisma.googleOAuthToken.upsert({
      where: { userId: user.userId },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date!),
        scope: tokens.scope!,
        tokenType: tokens.token_type || 'Bearer',
      },
      create: {
        userId: user.userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date!),
        scope: tokens.scope!,
        tokenType: tokens.token_type || 'Bearer',
      },
    });

    console.log('Google tokens saved successfully');

    return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard?success=google_connected`);
  } catch (error) {
    console.error('Google callback error:', error);
    return NextResponse.redirect(`${process.env.NEXTJS_URL}/dashboard?error=callback_failed`);
  }
}
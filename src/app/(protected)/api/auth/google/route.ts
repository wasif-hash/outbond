import { NextResponse, NextRequest } from 'next/server';
import { newOAuth2Client } from '@/lib/google-sheet/google-auth';
import { verifyAuth } from '@/lib/auth';
import { GoogleAuthResponse } from '@/types/google-sheet';


export async function GET(request: NextRequest) {
  try {
    console.log('Google auth route called');
    
    const authResult = await verifyAuth(request);
    console.log('Auth result:', authResult);
    
    if (!authResult.success || !authResult.user) {
      console.error('Authentication failed:', authResult.error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('User authenticated:', authResult.user);

    const oauth2Client = newOAuth2Client();
    
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    // Include user ID in state parameter to preserve it through OAuth flow
    const state = Buffer.from(JSON.stringify({
      userId: authResult.user.userId,
      email: authResult.user.email,
      role: authResult.user.role
    })).toString('base64');

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: state // Pass user info in state
    });

    console.log('Generated Google auth URL with state');
    
    const response: GoogleAuthResponse = { authUrl };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
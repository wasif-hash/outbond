import { google } from 'googleapis';

export function newOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.NEXTJS_URL}/api/auth/google/callback`
  );
}

export function createOAuth2Client() {
  return newOAuth2Client();
}

// Remove this function since we're handling URL generation in the route
// export function getGoogleAuthUrl(): string { ... }
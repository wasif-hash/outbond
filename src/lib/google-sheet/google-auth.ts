import { google } from 'googleapis';

export function newOAuth2Client(redirectPath: string = '/api/auth/google/callback') {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.NEXTJS_URL}${redirectPath}`
  );
}

export function createOAuth2Client(redirectPath?: string) {
  return newOAuth2Client(redirectPath);
}

// Remove this function since we're handling URL generation in the route
// export function getGoogleAuthUrl(): string { ... }

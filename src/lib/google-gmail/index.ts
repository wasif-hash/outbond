import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { GmailAccount } from '@prisma/client';

import { newOAuth2Client } from '@/lib/google-sheet/google-auth';
import { prisma } from '@/lib/prisma';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
]

export class GmailUnauthorizedClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GmailUnauthorizedClientError';
  }
}

export function createGmailOAuthClient(redirectPath: string = '/api/auth/google/gmail/callback') {
  return newOAuth2Client(redirectPath);
}

export async function createAuthorizedGmailClient(
  accessToken: string,
  refreshToken: string,
  redirectPath?: string,
): Promise<OAuth2Client> {
  const oauth2Client = createGmailOAuthClient(redirectPath);
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return oauth2Client;
}

export async function refreshGmailToken(
  gmailAccount: GmailAccount,
  redirectPath?: string,
): Promise<GmailAccount> {
  const oauth2Client = await createAuthorizedGmailClient(
    gmailAccount.accessToken,
    gmailAccount.refreshToken,
    redirectPath
  );

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    const nextAccessToken = credentials.access_token || gmailAccount.accessToken;
    const nextRefreshToken = credentials.refresh_token || gmailAccount.refreshToken;
    const expiryMs = credentials.expiry_date || Date.now() + 55 * 60 * 1000;

    return prisma.gmailAccount.update({
      where: { id: gmailAccount.id },
      data: {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
        expiresAt: new Date(expiryMs),
        tokenType: credentials.token_type || gmailAccount.tokenType,
        scope: credentials.scope || gmailAccount.scope,
      },
    });
  } catch (error: unknown) {
    const { message, code } = getGoogleAuthErrorDetails(error);
    const isUnauthorizedClient = message.toLowerCase().includes('unauthorized') || code === 401;

    console.error('Gmail token refresh failed:', error);

    if (isUnauthorizedClient) {
      throw new GmailUnauthorizedClientError(
        'Google rejected the Gmail OAuth client. Ensure the Gmail API is enabled for this Google Cloud project and reconnect the Gmail account.'
      );
    }

    throw new Error('Failed to refresh Gmail token');
  }
}

export async function ensureFreshGmailToken(
  gmailAccount: GmailAccount,
  redirectPath?: string,
) {
  const expiresAtMs =
    gmailAccount.expiresAt instanceof Date
      ? gmailAccount.expiresAt.getTime()
      : new Date(gmailAccount.expiresAt).getTime();

  if (!Number.isFinite(expiresAtMs) || expiresAtMs - Date.now() <= 5 * 60 * 1000) {
    return refreshGmailToken(gmailAccount, redirectPath)
  }
  return gmailAccount
}

export async function sendGmailMessage(
  gmailAccount: GmailAccount,
  opts: {
    to: string
    subject: string
    htmlBody: string
    textBody?: string
    replyTo?: string
  },
): Promise<string> {
  const refreshed = await ensureFreshGmailToken(gmailAccount)
  const oauth2Client = await createAuthorizedGmailClient(
    refreshed.accessToken,
    refreshed.refreshToken,
  )
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const mimeParts: string[] = []
  mimeParts.push(`From: ${refreshed.emailAddress}`)
  mimeParts.push(`To: ${opts.to}`)
  mimeParts.push(`Subject: ${opts.subject}`)
  if (opts.replyTo) {
    mimeParts.push(`Reply-To: ${opts.replyTo}`)
  }
  mimeParts.push('MIME-Version: 1.0')
  mimeParts.push('Content-Type: multipart/alternative; boundary="boundary"')
  mimeParts.push('')
  mimeParts.push('--boundary')
  mimeParts.push('Content-Type: text/plain; charset="UTF-8"')
  mimeParts.push('')
  mimeParts.push(opts.textBody || stripHtml(opts.htmlBody))
  mimeParts.push('--boundary')
  mimeParts.push('Content-Type: text/html; charset="UTF-8"')
  mimeParts.push('')
  mimeParts.push(opts.htmlBody)
  mimeParts.push('--boundary--')

  const rawMessage = mimeParts.join('\n')
  const encodedMessage = Buffer.from(rawMessage, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  })

  const messageId = response.data.id
  if (!messageId) {
    throw new Error('Gmail API did not return a message id')
  }
  return messageId
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

interface GoogleApiErrorShape {
  message?: unknown
  code?: unknown
  response?: {
    data?: {
      error_description?: unknown
      error?: unknown
    }
  }
}

const getGoogleAuthErrorDetails = (error: unknown): { message: string; code?: number } => {
  if (!error) {
    return { message: 'Unknown Gmail token error' }
  }

  if (typeof error === 'string') {
    return { message: error }
  }

  if (error instanceof Error) {
    const details = error as Error & GoogleApiErrorShape
    const message =
      (typeof details.response?.data?.error_description === 'string' && details.response.data.error_description) ||
      (typeof details.response?.data?.error === 'string' && details.response.data.error) ||
      details.message

    return {
      message,
      code: typeof details.code === 'number' ? details.code : undefined,
    }
  }

  if (typeof error === 'object') {
    const details = error as GoogleApiErrorShape
    const message =
      (typeof details.response?.data?.error_description === 'string' && details.response.data.error_description) ||
      (typeof details.response?.data?.error === 'string' && details.response.data.error) ||
      (typeof details.message === 'string' ? details.message : 'Unknown Gmail token error')

    return {
      message,
      code: typeof details.code === 'number' ? details.code : undefined,
    }
  }

  return { message: 'Unknown Gmail token error' }
}

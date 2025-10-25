import { google } from 'googleapis';

import { newOAuth2Client } from '@/lib/google-sheet/google-auth';
import { prisma } from '@/lib/prisma';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
]

type GmailAccountRecord = {
  id: string
  userId: string
  emailAddress: string
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scope: string
  tokenType: string
  historyId?: string | null
}

const db = prisma as any;

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
) {
  const oauth2Client = createGmailOAuthClient(redirectPath);
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return oauth2Client;
}

export async function refreshGmailToken(
  gmailAccount: GmailAccountRecord,
  redirectPath?: string,
): Promise<GmailAccountRecord> {
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

    return await db.gmailAccount.update({
      where: { id: gmailAccount.id },
      data: {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
        expiresAt: new Date(expiryMs),
        tokenType: credentials.token_type || gmailAccount.tokenType,
        scope: credentials.scope || gmailAccount.scope,
      },
    }) as GmailAccountRecord;
  } catch (error) {
    const rawMessage =
      (error as any)?.response?.data?.error_description ||
      (error as any)?.response?.data?.error ||
      (error as Error)?.message ||
      'Unknown Gmail token error';
    const isUnauthorizedClient =
      rawMessage.toLowerCase().includes('unauthorized') ||
      (error as any)?.code === 401;

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
  gmailAccount: GmailAccountRecord,
  redirectPath?: string,
) {
  const expiresAt = gmailAccount.expiresAt?.getTime?.() || gmailAccount.expiresAt.valueOf()
  if (!expiresAt || expiresAt - Date.now() <= 5 * 60 * 1000) {
    return refreshGmailToken(gmailAccount, redirectPath)
  }
  return gmailAccount
}

export async function sendGmailMessage(
  gmailAccount: GmailAccountRecord,
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

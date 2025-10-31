import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { GoogleOAuthToken } from '@prisma/client';
import { newOAuth2Client } from './google-auth';
import { prisma } from '../prisma';
import type { GoogleSpreadsheet } from '@/types/google-sheet';

export class GoogleDriveApiDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleDriveApiDisabledError';
  }
}

type GoogleApiError = Error & {
  code?: number | string
  response?: {
    data?: {
      error?: { message?: string }
      error_description?: string
      errorMessage?: string
    }
  }
  errors?: Array<{ reason?: string; message?: string }>
}

const toGoogleApiError = (error: unknown): GoogleApiError | null => {
  if (!error) {
    return null
  }
  if (error instanceof Error) {
    return error as GoogleApiError
  }
  if (typeof error === 'object') {
    const message = typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message?: string }).message
      : 'Unknown Google API error'
    return Object.assign(new Error(message), error) as GoogleApiError
  }
  return new Error(String(error)) as GoogleApiError
}

export async function createAuthorizedClient(accessToken: string, refreshToken: string): Promise<OAuth2Client> {
  const oauth2Client = newOAuth2Client();
  
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

export async function refreshTokenIfNeeded(
  oauth2Client: OAuth2Client,
  tokenRecord: GoogleOAuthToken, 
  userId: string
): Promise<string> {
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    const resolvedAccessToken = credentials.access_token || tokenRecord.accessToken;
    const resolvedRefreshToken = credentials.refresh_token || tokenRecord.refreshToken;
    const expiryDateMs = credentials.expiry_date || Date.now() + 55 * 60 * 1000; // default to ~55 minutes

    await prisma.googleOAuthToken.update({
      where: { userId },
      data: {
        accessToken: resolvedAccessToken,
        refreshToken: resolvedRefreshToken,
        expiresAt: new Date(expiryDateMs),
      }
    });

    return resolvedAccessToken;
  } catch (error: unknown) {
    console.error('Token refresh failed:', error);
    throw new Error('Failed to refresh Google token');
  }
}

export async function getUserSpreadsheets(oauth2Client: OAuth2Client): Promise<GoogleSpreadsheet[]> {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name, webViewLink)',
      pageSize: 100,
    });

    return (
      response.data.files?.flatMap((file): GoogleSpreadsheet[] => {
        if (!file?.id || !file.name || !file.webViewLink) {
          return []
        }
        return [
          {
            id: file.id,
            name: file.name,
            webViewLink: file.webViewLink,
          },
        ]
      }) ?? []
    );
  } catch (error: unknown) {
    const apiError = toGoogleApiError(error);
    const message =
      apiError?.response?.data?.error?.message ||
      apiError?.errors?.find((err) => typeof err?.message === 'string')?.message ||
      apiError?.message ||
      'Unknown Google Drive error';

    const isDisabled =
      message.includes('Google Drive API has not been used in project') ||
      message.includes('drive.googleapis.com') ||
      Number(apiError?.code) === 403;

    if (isDisabled) {
      throw new GoogleDriveApiDisabledError(
        'Google Drive API is disabled for the connected Google project. Enable the Drive API in Google Cloud Console and try again.'
      );
    }

    console.error('Failed to list Google Sheets via Drive API:', error);
    throw apiError ?? error;
  }
}

export async function getSpreadsheetData(
  oauth2Client: OAuth2Client, 
  spreadsheetId: string, 
  range: string = 'Sheet1'
): Promise<string[][]> {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values || [];
}

export async function getSpreadsheetInfo(oauth2Client: OAuth2Client, spreadsheetId: string) {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'properties,sheets.properties'
  });

  return response.data;
}

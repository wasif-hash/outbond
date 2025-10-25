import { google } from 'googleapis';
import { newOAuth2Client } from './google-auth';
import { GoogleOAuthToken } from '@prisma/client';
import { prisma } from '../prisma'; // Use your existing prisma instance
import { GoogleSpreadsheet } from '@/types/google-sheet';

export class GoogleDriveApiDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleDriveApiDisabledError';
  }
}


export async function createAuthorizedClient(accessToken: string, refreshToken: string) {
  const oauth2Client = newOAuth2Client();
  
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

export async function refreshTokenIfNeeded(
  oauth2Client: any, 
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
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw new Error('Failed to refresh Google token');
  }
}

export async function getUserSpreadsheets(oauth2Client: any): Promise<GoogleSpreadsheet[]> {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name, webViewLink)',
      pageSize: 100,
    });

    return (
      response.data.files?.map((file) => ({
        id: file.id!,
        name: file.name!,
        webViewLink: file.webViewLink!,
      })) || []
    );
  } catch (error) {
    const apiMessage =
      (error as any)?.response?.data?.error?.message ||
      (error as any)?.errors?.[0]?.message ||
      (error as Error)?.message ||
      'Unknown Google Drive error';

    const isDisabled =
      apiMessage.includes('Google Drive API has not been used in project') ||
      apiMessage.includes('drive.googleapis.com') ||
      (error as any)?.code === 403;

    if (isDisabled) {
      throw new GoogleDriveApiDisabledError(
        'Google Drive API is disabled for the connected Google project. Enable the Drive API in Google Cloud Console and try again.'
      );
    }

    console.error('Failed to list Google Sheets via Drive API:', error);
    throw error;
  }
}

export async function getSpreadsheetData(
  oauth2Client: any, 
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

export async function getSpreadsheetInfo(oauth2Client: any, spreadsheetId: string) {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'properties,sheets.properties'
  });

  return response.data;
}

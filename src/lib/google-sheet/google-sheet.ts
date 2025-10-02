import { google } from 'googleapis';
import { newOAuth2Client } from './google-auth';
import { GoogleOAuthToken } from '@prisma/client';
import { prisma } from '../prisma'; // Use your existing prisma instance
import { GoogleSpreadsheet } from '@/types/google-sheet';


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
    
    await prisma.googleOAuthToken.update({
      where: { userId },
      data: {
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token || tokenRecord.refreshToken,
        expiresAt: new Date(credentials.expiry_date!),
      }
    });

    return credentials.access_token!;
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw new Error('Failed to refresh Google token');
  }
}

export async function getUserSpreadsheets(oauth2Client: any): Promise<GoogleSpreadsheet[]> {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet'",
    fields: 'files(id, name, webViewLink)',
    pageSize: 100,
  });

  return response.data.files?.map(file => ({
    id: file.id!,
    name: file.name!,
    webViewLink: file.webViewLink!,
  })) || [];
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

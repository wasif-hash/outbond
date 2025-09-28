// src/types/google-sheet.ts (REPLACE EXISTING FILE)
export interface GoogleSpreadsheet {
  id: string;
  name: string;
  webViewLink: string;
}

export interface GoogleSheetInfo {
  id: number;
  title: string;
}

export interface SpreadsheetData {
  spreadsheet: {
    properties: {
      title: string;
    };
    sheets: Array<{
      properties: {
        sheetId: number;
        title: string;
      };
    }>;
  };
  data: string[][];
  sheets: GoogleSheetInfo[];
}

export interface GoogleConnectionStatus {
  isConnected: boolean;
  isExpired: boolean;
  connectedAt: string | null;
  expiresAt: string | null;
}

export interface GoogleAuthResponse {
  authUrl: string;
}

export interface GoogleSheetsListResponse {
  spreadsheets: GoogleSpreadsheet[];
}
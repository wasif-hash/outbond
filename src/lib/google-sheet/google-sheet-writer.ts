// src/lib/google-sheet-writer.ts
import { google } from 'googleapis'
import { LEAD_SHEET_COLUMNS, SheetLeadRow } from '../utils'

export async function writeLeadsToSheet(
  oauth2Client: any,
  spreadsheetId: string,
  range: string,
  rows: SheetLeadRow[],
  batchSize: number = 50
): Promise<number> {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client })
  let totalWritten = 0

  // Check if sheet has headers, if not add them
  await ensureHeaders(sheets, spreadsheetId, range)

  // Process leads in batches
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const values = batch.map(leadToSheetRow)

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values,
        },
      })

      totalWritten += batch.length
      console.log(`Written ${batch.length} leads to sheet (total: ${totalWritten})`)

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < rows.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

    } catch (error:any) {
      console.error(`Failed to write batch starting at index ${i}:`, error)
      
      // Check if it's an authentication scope error
      if (error.message && error.message.includes('insufficient authentication scopes')) {
        console.error('❌ Authentication scopes issue detected. Please reconnect your Google account.')
        throw new Error('Insufficient Google Sheets permissions. Please reconnect your Google account with write permissions.')
      }
      
      // Don't throw for other errors - continue with next batch
    }
  }

  return totalWritten
}

async function ensureHeaders(sheets: any, spreadsheetId: string, range: string) {
  try {
    // Extract sheet name from range (e.g., "Leads!A:Z" -> "Leads")
    const sheetName = range.includes('!') ? range.split('!')[0] : 'Sheet1'
    
    // Check if there are any values in the first row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:P1`, // First row
    })

    const existingHeaders = response.data.values?.[0]
    const headersMatch = Array.isArray(existingHeaders)
      && existingHeaders.length >= LEAD_SHEET_COLUMNS.length
      && LEAD_SHEET_COLUMNS.every((col, index) => (existingHeaders[index] || '').toString().trim().toLowerCase() === col.toLowerCase())

    if (!headersMatch) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:P1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [LEAD_SHEET_COLUMNS],
        },
      })

      console.log(`Added headers to spreadsheet ${spreadsheetId} in sheet ${sheetName}`)
    }
  } catch (error:any) {
    console.error('Failed to ensure headers:', error)
    
    // Check if it's an authentication scope error
    if (error.message && error.message.includes('insufficient authentication scopes')) {
      console.error('❌ Authentication scopes issue detected in headers check.')
      throw new Error('Insufficient Google Sheets permissions. Please reconnect your Google account with write permissions.')
    }
    
    // Continue without headers if this fails for other reasons
  }
}

function leadToSheetRow(lead: SheetLeadRow): string[] {
  return [
    lead.email,
    lead.firstName,
    lead.lastName,
    lead.phone,
    lead.company,
    lead.jobTitle,
    lead.website,
    lead.linkedinUrl,
    lead.industry,
    lead.streetAddress,
    lead.city,
    lead.state,
    lead.country,
    lead.postalCode,
    lead.formattedAddress,
    lead.summary,
  ]
}

export async function appendToSheet(
  oauth2Client: any,
  spreadsheetId: string,
  sheetName: string,
  values: string[][]
): Promise<void> {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client })

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values,
    },
  })
}

export async function createNewSheet(
  oauth2Client: any,
  spreadsheetId: string,
  sheetTitle: string
): Promise<number> {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client })

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetTitle,
            },
          },
        },
      ],
    },
  })

  return response.data.replies?.[0]?.addSheet?.properties?.sheetId || 0
}

export async function getSheetInfo(oauth2Client: any, spreadsheetId: string) {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client })

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'properties,sheets.properties',
  })

  return response.data
}

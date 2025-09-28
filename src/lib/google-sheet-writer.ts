// src/lib/google-sheet-writer.ts
import { google } from 'googleapis'
import { Lead } from '@prisma/client'

export async function writeLeadsToSheet(
  oauth2Client: any,
  spreadsheetId: string,
  range: string,
  leads: Lead[],
  batchSize: number = 50
): Promise<number> {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client })
  let totalWritten = 0

  // Check if sheet has headers, if not add them
  await ensureHeaders(sheets, spreadsheetId, range)

  // Process leads in batches
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize)
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
      if (i + batchSize < leads.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

    } catch (error) {
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
      range: `${sheetName}!A1:Z1`, // First row
    })

    if (!response.data.values || response.data.values.length === 0) {
      // No headers exist, add them
      const headers = [
        'Email',
        'First Name',
        'Last Name',
        'Phone',
        'Company',
        'Job Title',
        'Website',
        'LinkedIn URL',
        'Industry',
        'Location',
        'Tags',
        'Source',
        'Created At',
        'Updated At',
      ]

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:N1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      })

      console.log(`Added headers to spreadsheet ${spreadsheetId} in sheet ${sheetName}`)
    }
  } catch (error) {
    console.error('Failed to ensure headers:', error)
    
    // Check if it's an authentication scope error
    if (error.message && error.message.includes('insufficient authentication scopes')) {
      console.error('❌ Authentication scopes issue detected in headers check.')
      throw new Error('Insufficient Google Sheets permissions. Please reconnect your Google account with write permissions.')
    }
    
    // Continue without headers if this fails for other reasons
  }
}

function leadToSheetRow(lead: Lead): string[] {
  return [
    lead.email || '',
    lead.firstName || '',
    lead.lastName || '',
    lead.phone || '',
    lead.company || '',
    lead.jobTitle || '',
    lead.website || '',
    lead.linkedinUrl || '',
    lead.industry || '',
    lead.location || '',
    lead.tags.join(', '),
    lead.source || '',
    lead.createdAt.toISOString(),
    lead.updatedAt.toISOString(),
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


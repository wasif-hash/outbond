// src/lib/google-sheet-writer.ts
import { google, sheets_v4 } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { LEAD_SHEET_COLUMNS, SheetLeadRow } from '../utils'

const MAX_REQUESTS_PER_MINUTE = 60
const DEFAULT_BATCH_SIZE = 500
const MAX_APPEND_RETRIES = 5

export async function writeLeadsToSheet(
  oauth2Client: OAuth2Client,
  spreadsheetId: string,
  range: string,
  rows: SheetLeadRow[],
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<number> {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client })
  let totalWritten = 0
  const throttleDelayMs = Math.max(1000, Math.floor(60000 / MAX_REQUESTS_PER_MINUTE))

  // Check if sheet has headers, if not add them
  await ensureHeaders(sheets, spreadsheetId, range)

  // Process leads in batches
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const values = batch.map(leadToSheetRow)

    await appendWithRetry(sheets, {
      spreadsheetId,
      range,
      values,
    })

    totalWritten += batch.length
    console.log(`Written ${batch.length} leads to sheet (total: ${totalWritten})`)

    if (i + batchSize < rows.length) {
      await delay(throttleDelayMs)
    }
  }

  return totalWritten
}

async function appendWithRetry(
  sheets: sheets_v4.Sheets,
  params: {
    spreadsheetId: string
    range: string
    values: string[][]
  }
) {
  let attempt = 0
  let backoffMs = 1000

  while (attempt <= MAX_APPEND_RETRIES) {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: params.spreadsheetId,
        range: params.range,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: params.values,
        },
      })
      return
    } catch (error: unknown) {
      const statusCode = extractStatusCode(error)
      const message = extractMessage(error)
      const isAuthScopeError = message?.includes('insufficient authentication scopes')
      const shouldRetry = statusCode === 429 || (statusCode !== null && statusCode >= 500 && statusCode < 600)

      console.error(`Failed to write batch (attempt ${attempt + 1}):`, error)

      if (isAuthScopeError) {
        console.error('❌ Authentication scopes issue detected. Please reconnect your Google account.')
        throw new Error('Insufficient Google Sheets permissions. Please reconnect your Google account with write permissions.')
      }

      if (!shouldRetry || attempt === MAX_APPEND_RETRIES) {
        throw new Error(`Failed to append values to Google Sheet after ${attempt + 1} attempts.`)
      }

      await delay(backoffMs)
      backoffMs = Math.min(backoffMs * 2, 30000)
      attempt += 1
    }
  }
}

type GoogleError = {
  response?: { status?: number }
  code?: number | string
  errors?: Array<{ reason?: string }>
}

const extractStatusCode = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') {
    return null
  }

  const maybeError = error as GoogleError

  if (typeof maybeError.response?.status === 'number') {
    return maybeError.response.status
  }

  if (typeof maybeError.code === 'number') {
    return maybeError.code
  }

  const numericCode = Number(maybeError.code)
  if (Number.isFinite(numericCode)) {
    return numericCode
  }

  const rateLimitReason = maybeError.errors?.find((err) =>
    typeof err?.reason === 'string' &&
    (err.reason === 'rateLimitExceeded' || err.reason === 'userRateLimitExceeded'),
  )

  if (rateLimitReason) {
    return 429
  }

  return null
}

const extractMessage = (error: unknown): string | null => {
  if (!error) {
    return null
  }
  if (typeof error === 'string') {
    return error
  }
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return null
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return
  }
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function ensureHeaders(sheets: sheets_v4.Sheets, spreadsheetId: string, range: string) {
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
  } catch (error: unknown) {
    console.error('Failed to ensure headers:', error)
    
    // Check if it's an authentication scope error
    if (error instanceof Error && error.message.includes('insufficient authentication scopes')) {
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
  oauth2Client: OAuth2Client,
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
  oauth2Client: OAuth2Client,
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

export async function getSheetInfo(oauth2Client: OAuth2Client, spreadsheetId: string) {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client })

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'properties,sheets.properties',
  })

  return response.data
}

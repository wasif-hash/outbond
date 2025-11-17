import { SpreadsheetData } from "@/types/google-sheet"
import { LEAD_SHEET_COLUMNS } from "../utils"
import { DraftStatus, SheetLead } from "@/types/outreach"



export function parseSheet(sheet: SpreadsheetData): SheetLead[] {
  const rows = sheet.data || []
  if (rows.length < 2) return []
  const headerRow = rows[0]?.map((cell) => cell?.toString().trim().toLowerCase()) ?? []
  const indexFor = (key: string) => headerRow.findIndex((value) => value === key.toLowerCase())

  const emailIndex = findEmailIndex(headerRow)
  const firstNameIndex = indexFor('first name')
  const lastNameIndex = indexFor('last name')
  const companyIndex = indexFor('company')
  const summaryIndex = indexFor('summary')
  const roleIndex = indexFor('job title')

  const leads: SheetLead[] = []

  rows.slice(1).forEach((row, offset) => {
    const email = row[emailIndex]?.toString().trim().toLowerCase()
    if (!email) return
    if (!email.includes('@')) return

    leads.push({
      rowIndex: offset + 1,
      email,
      firstName: firstNameIndex >= 0 ? row[firstNameIndex]?.toString().trim() : undefined,
      lastName: lastNameIndex >= 0 ? row[lastNameIndex]?.toString().trim() : undefined,
      company: companyIndex >= 0 ? row[companyIndex]?.toString().trim() : undefined,
      summary: summaryIndex >= 0 ? row[summaryIndex]?.toString().trim() : undefined,
      role: roleIndex >= 0 ? row[roleIndex]?.toString().trim() : undefined,
      sourceRowRef: String(offset + 2),
    })
  })

  return leads
}

export function findEmailIndex(headers: string[]): number {
  const normalizedColumns = LEAD_SHEET_COLUMNS.map((col) => col.toLowerCase())
  const emailVariants = new Set(['email', 'email address', 'e-mail'])
  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i]
    if (!header) continue
    if (emailVariants.has(header)) return i
    if (normalizedColumns[0] === header) return i
  }
  return 0
}

export function statusVariant(status: DraftStatus): "default" | "outline" | "positive" | "destructive" | "neutral" {
  switch (status) {
    case 'queued':
      return 'neutral'
    case 'sent':
      return 'positive'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

export function jobStatusVariant(status: string): "default" | "outline" | "positive" | "destructive" | "neutral" {
  switch (status.toUpperCase()) {
    case 'QUEUED':
      return 'neutral'
    case 'SENT':
      return 'positive'
    case 'FAILED':
      return 'destructive'
    default:
      return 'outline'
  }
}

export function jobStatusBadgeProps(
  status: string | null | undefined,
): { label: string; className: string } {
  const normalized = (status ?? '').toUpperCase()

  switch (normalized) {
    case 'SENT':
      return {
        label: 'Sent',
        className: 'border-transparent bg-emerald-500 text-white hover:bg-emerald-500/90',
      }
    case 'QUEUED':
      return {
        label: 'Queued',
        className: 'border-transparent bg-amber-500 text-white hover:bg-amber-500/90',
      }
    case 'RUNNING':
    case 'PROCESSING':
      return {
        label: 'Processing',
        className: 'border-transparent bg-sky-500 text-white hover:bg-sky-500/90',
      }
    case 'FAILED':
      return {
        label: 'Failed',
        className: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
      }
    case 'PENDING':
      return {
        label: 'Pending',
        className: 'border-border bg-muted text-foreground',
      }
    case 'DRAFT':
      return {
        label: 'Draft',
        className: 'border-dashed border-border bg-transparent text-muted-foreground',
      }
    default:
      return {
        label: normalized || 'Pending',
        className: 'border-border bg-muted text-foreground',
      }
  }
}

// src/lib/utils.ts (updated with additional utilities)
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import crypto from 'crypto'
import { ApolloLead } from './apollo'

export const LEAD_SHEET_COLUMNS = [
  'Email',
  'First Name',
  'Last Name',
  'Phone',
  'Company',
  'Job Title',
  'Website',
  'LinkedIn URL',
  'Industry',
  'Street Address',
  'City',
  'State',
  'Country',
  'Postal Code',
  'Formatted Address',
  'Summary'
]

export function formatLocation(location: { city?: string; state?: string; country?: string }) {
  const parts = []
  if (location.city) parts.push(location.city)
  if (location.state) parts.push(location.state)
  if (location.country) parts.push(location.country)
  return parts.join(', ')
}

export function generateLeadSummary(lead: ApolloLead): string {
  const lines: string[] = []

  const name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'This contact'
  const company = lead.company_name || 'their organisation'

  if (lead.title) {
    lines.push(`${name} serves as ${lead.title} at ${company}.`)
  } else {
    lines.push(`${name} is associated with ${company}.`)
  }

  if (lead.domain) {
    lines.push(`Company web presence: ${lead.domain}.`)
  }

  if (lead.linkedin_url) {
    lines.push(`LinkedIn profile: ${lead.linkedin_url}.`)
  }

  if (lead.email) {
    lines.push(`Primary contact email: ${lead.email}.`)
  }

  if (lines.length < 2) {
    lines.push('Additional enrichment is recommended to personalise outreach.')
  }

  return lines.slice(0, 4).join('\n')
}

const GENERIC_EMAIL_LOCALS = new Set(['example', 'test', 'testing', 'demo', 'sample', 'unknown', 'noemail'])
const GENERIC_EMAIL_DOMAINS = new Set(['example.com', 'test.com'])
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'fakemail.com'
])

export function sanitizeEmailForSheet(email?: string | null): string {
  if (!email) return ''

  const normalized = email.toLowerCase().trim()

  if (!isValidEmail(normalized)) {
    return ''
  }

  const [local, domain] = normalized.split('@')

  if (!local || !domain) {
    return ''
  }

  if (normalized.includes('not_unlocked')) {
    return ''
  }

  if (GENERIC_EMAIL_LOCALS.has(local) || GENERIC_EMAIL_DOMAINS.has(domain)) {
    return ''
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain) || domain.includes('mailinator')) {
    return ''
  }

  return normalized
}

export interface SheetLeadRow {
  email: string
  firstName: string
  lastName: string
  phone: string
  company: string
  jobTitle: string
  website: string
  linkedinUrl: string
  industry: string
  streetAddress: string
  city: string
  state: string
  country: string
  postalCode: string
  formattedAddress: string
  summary: string
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate idempotency key for campaigns
export function generateIdempotencyKey(campaignId: string, type: 'initial' | 'retry' = 'initial', suffix?: string): string {
  const parts = [campaignId, type]
  if (suffix) {
    parts.push(suffix)
  }
  return parts.join(':')
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Format campaign status for display
export function formatCampaignStatus(status: string): { label: string; variant: string } {
  switch (status.toUpperCase()) {
    case 'PENDING':
      return { label: 'Pending', variant: 'neutral' }
    case 'RUNNING':
      return { label: 'Running', variant: 'positive' }
    case 'SUCCEEDED':
      return { label: 'Completed', variant: 'positive' }
    case 'FAILED':
      return { label: 'Failed', variant: 'negative' }
    case 'RATE_LIMITED':
      return { label: 'Rate Limited', variant: 'neutral' }
    case 'CANCELLED':
      return { label: 'Cancelled', variant: 'neutral' }
    default:
      return { label: 'Unknown', variant: 'neutral' }
  }
}

// Calculate retry delay with exponential backoff
export function calculateRetryDelay(attemptNumber: number, baseDelay: number = 3000, maxDelay: number = 300000): number {
  const delay = baseDelay * Math.pow(2, attemptNumber - 1)
  return Math.min(delay, maxDelay)
}

// Generate secure random string
export function generateSecureRandom(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

// Chunk array into smaller arrays
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

// Delay/sleep utility
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Format numbers for display
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// Format relative time
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}h ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays}d ago`
  }

  return date.toLocaleDateString()
}

// Validate campaign data
interface CampaignData {
  name: string
  jobTitles: string[]
  keywords: string
  locations: string[]
  googleSheetId: string
  maxLeads: number
  pageSize?: number
  includeDomains?: string
  excludeDomains?: string
  searchMode?: 'balanced' | 'conserve'
}

export function validateCampaignData(data: CampaignData): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data.name?.trim()) {
    errors.push('Campaign name is required')
  }

  if (!Array.isArray(data.jobTitles) || data.jobTitles.length === 0 ||
      (data.jobTitles.length === 1 && !data.jobTitles[0].trim())) {
    errors.push('At least one job title is required')
  }

  if (!Array.isArray(data.locations) || data.locations.length === 0 ||
      (data.locations.length === 1 && !data.locations[0].trim())) {
    errors.push('At least one location is required')
  }

  // Additional validation for job titles and locations
  if (Array.isArray(data.jobTitles)) {
    const titles = typeof data.jobTitles[0] === 'string' 
      ? data.jobTitles[0].split(',').map(t => t.trim()).filter(Boolean)
      : data.jobTitles.map(t => t.trim()).filter(Boolean)
      
    if (titles.length === 0) {
      errors.push('At least one valid job title is required')
    }
  }

  if (Array.isArray(data.locations)) {
    const locs = typeof data.locations[0] === 'string'
      ? data.locations[0].split(',').map(l => l.trim()).filter(Boolean)
      : data.locations.map(l => l.trim()).filter(Boolean)
      
    if (locs.length === 0) {
      errors.push('At least one valid location is required')
    }
  }

  if (!data.googleSheetId) {
    errors.push('Google Sheet selection is required')
  }

  if (data.maxLeads < 1 || data.maxLeads > 10000) {
    errors.push('Max leads must be between 1 and 10,000')
  }

  if (typeof data.pageSize !== 'undefined') {
    if (data.pageSize < 1 || data.pageSize > 100) {
      errors.push('Leads per request must be between 1 and 100')
    }
  }

  // Validate domains format if provided
  if (data.includeDomains) {
    const domains = data.includeDomains.split(',').map(d => d.trim())
    if (domains.some(d => !d.includes('.'))) {
      errors.push('Include domains must be valid domain names (e.g., example.com)')
    }
  }

  if (data.excludeDomains) {
    const domains = data.excludeDomains.split(',').map(d => d.trim())
    if (domains.some(d => !d.includes('.'))) {
      errors.push('Exclude domains must be valid domain names (e.g., example.com)')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

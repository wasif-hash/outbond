// src/lib/utils.ts (updated with additional utilities)
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import crypto from 'crypto'

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

// Sanitize search parameters for Instantly API
export function sanitizeSearchParams(params: {
  niche?: string
  keywords?: string
  location?: string
}): {
  niche: string
  keywords?: string
  location?: string
} {
  return {
    niche: params.niche?.trim() || '',
    keywords: params.keywords?.trim() || undefined,
    location: params.location?.trim() || undefined,
  }
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
export function validateCampaignData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Campaign name is required')
  }

  if (!data.nicheOrJobTitle || data.nicheOrJobTitle.trim().length === 0) {
    errors.push('Niche or job title is required')
  }

  if (!data.location || data.location.trim().length === 0) {
    errors.push('Location is required')
  }

  if (!data.googleSheetId || data.googleSheetId.trim().length === 0) {
    errors.push('Google Sheet selection is required')
  }

  if (data.maxLeads && (isNaN(data.maxLeads) || data.maxLeads <= 0 || data.maxLeads > 10000)) {
    errors.push('Max leads must be between 1 and 10,000')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
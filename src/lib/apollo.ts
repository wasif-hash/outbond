// src/lib/apollo.ts
import { RateLimiter } from '@/lib/rate-limit'

const APOLLO_API_BASE = 'https://api.apollo.io/api/v1'

export interface ApolloLead {
  id: string
  first_name: string
  last_name: string
  title: string
  company_name: string
  domain: string
  email: string
  linkedin_url: string
  phone?: string
  industry?: string
  street_address?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
  formatted_address?: string
  summary?: string // AI-generated summary
}

interface ApolloBulkMatchPersonRequest {
  identifier: string
  first_name?: string
  last_name?: string
  title?: string
  organization_name?: string
  linkedin_url?: string
  city?: string
  state?: string
  country?: string
}

interface ApolloBulkMatchPersonResponse {
  request?: {
    identifier?: string
    client_identifier?: string
  }
  person?: {
    id?: string
    email?: string
    emails?: Array<{ value?: string; email?: string }>
    emails_raw?: string[]
    phone_number?: string
    mobile_number?: string
    phone_numbers?: Array<{ number?: string } | string>
    linkedin_url?: string
    city?: string
    state?: string
    country?: string
    street_address?: string
    postal_code?: string
    formatted_address?: string
    organization?: {
      name?: string
      website_url?: string
      linkedin_url?: string
      industry?: string
    }
  }
}

interface ApolloBulkMatchResponse {
  people?: ApolloBulkMatchPersonResponse[]
}

interface ApolloRevealEmailResponse {
  email?: string | null
}

export interface ApolloSearchResponse {
  people: Array<{
    id: string
    first_name: string
    last_name: string
    title: string
    organization: {
      name: string
      website_url: string
      industry?: string
    }
    email: string
    linkedin_url: string
    phone_numbers?: Array<{ number?: string | null }>
    city?: string | null
    state?: string | null
    country?: string | null
    street_address?: string | null
    postal_code?: string | null
    formatted_address?: string | null
  }>
  pagination: {
    total_entries: number
    per_page: number
    current_page: number
    total_pages: number
  }
}

export interface ApolloSearchFilters {
  person_titles: string[]
  person_locations: string[]
  keywords?: string[]
  page?: number
  per_page?: number
}

interface ApolloBulkMatchPersonRequest {
  identifier: string
  first_name?: string
  last_name?: string
  title?: string
  organization_name?: string
  domain?: string
  linkedin_url?: string
  email?: string
  city?: string
  state?: string
  country?: string
}

interface ApolloBulkMatchResponse {
  matches?: Array<{
    id?: string
    client_identifier?: string
    email?: string
    emails?: Array<{ email?: string; value?: string }>
    emails_raw?: string[]
    phone_number?: string
    mobile_number?: string
    phone_numbers?: Array<{ number?: string } | string>
    linkedin_url?: string
    street_address?: string
    city?: string
    state?: string
    country?: string
    postal_code?: string
    formatted_address?: string
    organization?: {
      name?: string
      website_url?: string
      linkedin_url?: string
      industry?: string
    }
  }>
}

export class ApolloError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ApolloError'
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }

  get isServerError(): boolean {
    return this.status >= 500
  }

  get shouldRetry(): boolean {
    return this.isRateLimited || this.isServerError
  }
}

export class ApolloClient {
  private apiKey: string | null | undefined
  private baseUrl: string
  private rateLimiter: RateLimiter

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.APOLLO_API_KEY
    this.baseUrl = APOLLO_API_BASE
    // Allow 10 requests per second with bursts up to 20
    this.rateLimiter = new RateLimiter(10, 1000, 20)
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    if (!this.apiKey) {
      throw new ApolloError(401, 'APOLLO_API_KEY is required but not provided')
    }

    // Wait for rate limiter
    await this.rateLimiter.acquire()

    const url = `${this.baseUrl}${path}`

    console.log(`🌐 ${method} ${url}`)
    if (body) {
      console.log(`📦 Request body:`, JSON.stringify(body, null, 2))
    }

    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'Cache-Control': 'no-cache',
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (body && method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json'
      options.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, options)

      console.log(`📊 Response: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ API Error Response:`, errorText)
        
        let errorDetails: any
        try {
          errorDetails = JSON.parse(errorText)
        } catch {
          errorDetails = { message: errorText }
        }
        
        throw new ApolloError(
          response.status,
          errorDetails?.error || errorDetails?.message || `Apollo API error: ${response.statusText}`,
          errorDetails
        )
      }

      const data = await response.json()
      return data as T
    } catch (error:any) {
      if (error instanceof ApolloError) {
        throw error
      }
      throw new ApolloError(500, `Request failed: ${error.message}`)
    }
  }

  /**
   * Search for leads using Apollo's mixed_people/search endpoint
   */
  async searchLeads(filters: ApolloSearchFilters): Promise<ApolloSearchResponse> {
    console.log(`🔍 Searching leads with filters:`, filters)

    const queryParams = new URLSearchParams()

    // Add person titles
    filters.person_titles.forEach(title => {
      queryParams.append('person_titles[]', title)
    })

    // Add locations
    filters.person_locations.forEach(location => {
      queryParams.append('person_locations[]', location)
    })

    // Add optional keyword filters
    if (filters.keywords) {
      filters.keywords
        .map(keyword => keyword.trim())
        .filter(Boolean)
        .forEach(keyword => {
          queryParams.append('person_keywords[]', keyword)
        })
    }

    // Add pagination
    if (filters.page) queryParams.append('page', filters.page.toString())
    if (filters.per_page) queryParams.append('per_page', filters.per_page.toString())

    const endpoint = `/mixed_people/search?${queryParams.toString()}`
    return this.request<ApolloSearchResponse>('POST', endpoint)
  }

  async bulkMatchPeople(
    people: ApolloBulkMatchPersonRequest[],
    options: { revealPersonalEmails?: boolean; revealPhoneNumber?: boolean } = {}
  ): Promise<ApolloBulkMatchResponse> {
    if (!people.length) {
      return { matches: [] }
    }

    const params = new URLSearchParams()
    params.set('reveal_personal_emails', String(options.revealPersonalEmails ?? true))
    params.set('reveal_phone_number', String(options.revealPhoneNumber ?? false))

    const details = people.map(person => {
      const detail: Record<string, any> = {
        client_identifier: person.identifier,
      }

      if (person.identifier) {
        detail.id = person.identifier
      }

      if (person.first_name) {
        detail.first_name = person.first_name
      }

      if (person.last_name) {
        detail.last_name = person.last_name
      }

      if (person.first_name && person.last_name) {
        detail.name = `${person.first_name} ${person.last_name}`
      }

      if (person.email && !person.email.includes('not_unlocked')) {
        detail.email = person.email
      }

      if (person.title) {
        detail.title = person.title
      }

      if (person.organization_name) {
        detail.organization_name = person.organization_name
      }

      if (person.domain) {
        detail.domain = person.domain
      }

      if (person.linkedin_url) {
        detail.linkedin_url = person.linkedin_url
      }

      if (person.city) {
        detail.city = person.city
      }

      if (person.state) {
        detail.state = person.state
      }

      if (person.country) {
        detail.country = person.country
      }

      return detail
    }).filter(detail => Object.keys(detail).length > 1)

    if (details.length === 0) {
      return { matches: [] }
    }

    const endpoint = `/people/bulk_match?${params.toString()}`
    return this.request<ApolloBulkMatchResponse>('POST', endpoint, { details })
  }

  /**
   * Attempt to reveal/unlock an email for a given Apollo person id
   */
  async revealEmail(personId: string): Promise<string | null> {
    if (!personId) return null

    try {
      const endpoint = `/people/${personId}/reveal_email`
      const response = await this.request<ApolloRevealEmailResponse>('POST', endpoint, {})
      const email = response?.email ? response.email.trim() : ''
      return email || null
    } catch (error) {
      if (error instanceof ApolloError) {
        if (error.status === 402 || error.status === 403) {
          console.warn(`⚠️ Apollo email reveal requires additional credits or permissions for person ${personId}`)
          return null
        }
        if (error.status === 404) {
          console.warn(`⚠️ Apollo could not reveal email for person ${personId}`)
          return null
        }
      }
      console.error(`❌ Failed to reveal email for Apollo person ${personId}:`, error)
      return null
    }
  }

  /**
   * Generate a summary for a lead using their data
   */
  private generateLeadSummary(lead: any): string {
    const lines: string[] = []
    const name = [lead.first_name, lead.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || 'This contact'

    if (lead.title && lead.organization?.name) {
      lines.push(`${name} works as ${lead.title} at ${lead.organization.name}.`)
    } else if (lead.title) {
      lines.push(`${name} holds the title of ${lead.title}.`)
    } else if (lead.organization?.name) {
      lines.push(`${name} is part of ${lead.organization.name}.`)
    }

    if (lead.organization?.industry) {
      lines.push(`The company operates in the ${lead.organization.industry} sector.`)
    }

    if (lead.organization?.website_url) {
      lines.push(`Company website: ${lead.organization.website_url}.`)
    }

    if (lead.linkedin_url) {
      lines.push(`LinkedIn profile: ${lead.linkedin_url}.`)
    }

    if (lead.email) {
      lines.push(`Primary contact email: ${lead.email}.`)
    }

    if (lines.length === 0) {
      lines.push(`${name} is a prospective contact sourced via Apollo.`)
    }

    return lines.slice(0, 4).join('\n')
  }

  /**
   * Process and enrich leads with AI-generated summaries
   */
  processLeads(leads: any[]): ApolloLead[] {
    return leads.map((lead: any) => {
      const primaryPhone = Array.isArray(lead.phone_numbers) && lead.phone_numbers.length > 0
        ? (lead.phone_numbers.find((p: any) => p?.number)?.number || lead.phone_numbers[0]?.number || '')
        : ''

      return {
        id: lead.id,
        first_name: lead.first_name || '',
        last_name: lead.last_name || '',
        title: lead.title || '',
        company_name: lead.organization?.name || '',
        domain: lead.organization?.website_url || '',
        email: lead.email || '',
        linkedin_url: lead.linkedin_url || '',
        phone: primaryPhone || '',
        industry: lead.organization?.industry || '',
        street_address: lead.street_address || '',
        city: lead.city || '',
        state: lead.state || '',
        country: lead.country || '',
        postal_code: lead.postal_code || '',
        formatted_address: lead.formatted_address || '',
        summary: this.generateLeadSummary(lead)
      }
    })
  }

  /**
   * Check API connection
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.searchLeads({
        person_titles: ['CEO'],
        person_locations: ['United States'],
        per_page: 1
      })
      return true
    } catch (error) {
      console.error('Apollo API connection test failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const apollo = new ApolloClient()

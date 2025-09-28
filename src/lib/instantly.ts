// src/lib/instantly.ts (REPLACE EXISTING)
const INSTANTLY_API_BASE = 'https://api.instantly.ai'
const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY!

if (!INSTANTLY_API_KEY) {
  throw new Error('INSTANTLY_API_KEY environment variable is required')
}

export interface InstantlyLead {
  id: string
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  company?: string
  job_title?: string
  website?: string
  linkedin_url?: string
  industry?: string
  location?: string
  tags?: string[]
  timestamp_created: string
  organization_id: string
  status?: string
  list_id?: string
}

export interface LeadSearchResponse {
  data: InstantlyLead[]
  pagination?: {
    has_more: boolean
    next_cursor?: string
    total_count?: number
  }
}

export class InstantlyError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: string
  ) {
    super(message)
    this.name = 'InstantlyError'
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }

  get isServerError(): boolean {
    return this.status >= 500
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500
  }

  get shouldRetry(): boolean {
    return this.isRateLimited || this.isServerError
  }
}

export class InstantlyClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string = INSTANTLY_API_KEY) {
    this.apiKey = apiKey
    this.baseUrl = INSTANTLY_API_BASE
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    
    console.log(`🌐 ${method} ${url}`)
    if (body) {
      console.log(`📦 Request body:`, JSON.stringify(body, null, 2))
    }
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    console.log(`📊 Response: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`❌ API Error Response:`, errorText)
      
      let errorDetails: any
      try {
        errorDetails = JSON.parse(errorText)
      } catch {
        errorDetails = errorText
      }
      
      throw new InstantlyError(
        response.status,
        `Instantly API error: ${response.statusText}`,
        JSON.stringify(errorDetails)
      )
    }

    const data = await response.json()
    console.log(`✅ Response data:`, JSON.stringify(data, null, 2))
    return data
  }

  /**
   * Search for leads using the /api/v2/leads endpoint
   */
  async searchLeads(params: {
    search?: string
    filter?: 'FILTER_VAL_ALL' | 'FILTER_VAL_UNCONTACTED' | 'FILTER_VAL_VERIFIED' | 'FILTER_VAL_INVALID'
    limit?: number
    starting_after?: string
    list_id?: string
  }): Promise<LeadSearchResponse> {
    console.log(`🔍 Searching leads with params:`, params)
    
    // Build query parameters for GET request
    const queryParams = new URLSearchParams()
    
    if (params.limit) {
      queryParams.append('limit', params.limit.toString())
    }
    
    if (params.search) {
      queryParams.append('search', params.search)
    }
    
    if (params.filter) {
      queryParams.append('filter', params.filter)
    }
    
    if (params.starting_after) {
      queryParams.append('starting_after', params.starting_after)
    }

    if (params.list_id) {
      queryParams.append('list_id', params.list_id)
    }
    
    const queryString = queryParams.toString()
    const endpoint = queryString ? `/api/v2/leads?${queryString}` : '/api/v2/leads'
    
    const response = await this.request<{
      data?: InstantlyLead[]
      items?: InstantlyLead[]
      pagination?: any
    }>('GET', endpoint)
    
    // Handle both possible response formats
    const leads = response.data || response.items || []
    console.log(`✅ Search returned ${leads.length} leads`)
    
    return {
      data: leads,
      pagination: response.pagination
    }
  }

  /**
   * Get leads from a specific list
   */
  async getLeadsFromList(listId: string, params?: {
    limit?: number
    starting_after?: string
    search?: string
  }): Promise<LeadSearchResponse> {
    console.log(`📋 Getting leads from list ${listId}`)
    
    // Build query parameters for GET request
    const queryParams = new URLSearchParams()
    queryParams.append('list_id', listId)
    
    if (params?.limit) {
      queryParams.append('limit', params.limit.toString())
    }
    
    if (params?.starting_after) {
      queryParams.append('starting_after', params.starting_after)
    }
    
    if (params?.search) {
      queryParams.append('search', params.search)
    }
    
    const queryString = queryParams.toString()
    const endpoint = `/api/v2/leads?${queryString}`
    
    const response = await this.request<{
      data?: InstantlyLead[]
      items?: InstantlyLead[]
      pagination?: any
    }>('GET', endpoint)
    
    const leads = response.data || response.items || []
    console.log(`✅ Retrieved ${leads.length} leads from list`)
    
    return {
      data: leads,
      pagination: response.pagination
    }
  }

  /**
   * Create a lead list
   */
  async createLeadList(name: string, hasEnrichmentTask = false): Promise<string> {
    console.log(`📝 Creating lead list: ${name}`)
    
    const response = await this.request<{
      id: string
      organization_id: string
      name: string
      timestamp_created: string
      has_enrichment_task: boolean | null
    }>('POST', '/api/v2/lead-lists', {
      name,
      has_enrichment_task: hasEnrichmentTask
    })
    
    console.log(`✅ Created lead list with ID: ${response.id}`)
    return response.id
  }

  /**
   * Get all lead lists
   */
  async getLeadLists(params?: {
    limit?: number
    starting_after?: string
    search?: string
  }): Promise<{ items: any[] }> {
    console.log(`📋 Getting all lead lists`)
    
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.starting_after) queryParams.append('starting_after', params.starting_after)
    if (params?.search) queryParams.append('search', params.search)
    
    const queryString = queryParams.toString()
    const endpoint = queryString ? `/api/v2/lead-lists?${queryString}` : '/api/v2/lead-lists'
    
    return this.request<{ items: any[] }>('GET', endpoint)
  }

  /**
   * Add leads to a list manually
   */
  async addLeadsToList(listId: string, leads: Array<{
    email: string
    first_name?: string
    last_name?: string
    phone?: string
    company?: string
    job_title?: string
    website?: string
    linkedin_url?: string
    location?: string
  }>): Promise<void> {
    console.log(`➕ Adding ${leads.length} leads to list ${listId}`)
    
    await this.request('POST', `/api/v2/lead-lists/${listId}/leads`, {
      leads
    })
    
    console.log(`✅ Successfully added leads to list`)
  }

  /**
   * Get account information
   */
  async getAccountInfo() {
    console.log(`👤 Getting account information`)
    return this.request('GET', '/api/v2/auth/me')
  }

  /**
   * Parse location into a format Instantly might accept
   */
  private parseLocation(location: string): { city?: string; country?: string; state?: string } {
    const parts = location.split(',').map(p => p.trim())
    
    if (parts.length === 1) {
      // Could be city, state, or country
      return { city: parts[0] }
    } else if (parts.length === 2) {
      // Could be "City, Country" or "City, State"
      return { city: parts[0], country: parts[1] }
    } else if (parts.length === 3) {
      // "City, State, Country"
      return { city: parts[0], state: parts[1], country: parts[2] }
    }
    
    return { city: location }
  }

  /**
   * Search for leads with enhanced filtering
   */
  async searchLeadsEnhanced(params: {
    jobTitle: string
    location?: string
    keywords?: string[]
    limit?: number
  }): Promise<LeadSearchResponse> {
    // Build search query
    const searchTerms = [params.jobTitle]
    
    if (params.location) {
      searchTerms.push(params.location)
    }
    
    if (params.keywords && params.keywords.length > 0) {
      searchTerms.push(...params.keywords)
    }
    
    const searchQuery = searchTerms.join(' ')
    
    return this.searchLeads({
      search: searchQuery,
      filter: 'FILTER_VAL_UNCONTACTED',
      limit: params.limit || 50
    })
  }

  /**
   * Attach enrichment to a lead list
   */
  async attachEnrichment(listId: string, enrichmentType: string): Promise<void> {
    console.log(`🔗 Attaching enrichment ${enrichmentType} to list ${listId}`)
    
    await this.request('POST', `/api/v2/lead-lists/${listId}/enrichment`, {
      enrichment_type: enrichmentType
    })
    
    console.log(`✅ Enrichment attached successfully`)
  }

  /**
   * Import leads from SuperSearch
   */
  async importFromSuperSearch(params: {
    listId: string
    limit?: number
    skipNoEmail?: boolean
    searchFilters: {
      locations?: Array<{ value: string; type: string }>
      department?: string[]
      level?: string[]
      employee_count?: string[]
      keywords?: string[]
    }
  }): Promise<{ jobId?: string; message: string }> {
    console.log(`🔍 Starting SuperSearch import for list ${params.listId}`)
    
    const requestBody = {
      list_id: params.listId,
      limit: params.limit || 100,
      skip_no_email: params.skipNoEmail || true,
      search_filters: params.searchFilters
    }
    
    const response = await this.request<{
      job_id?: string
      message: string
    }>('POST', '/api/v2/super-search/import', requestBody)
    
    console.log(`✅ SuperSearch import started:`, response)
    return response
  }

  /**
   * Wait for a job to complete
   */
  async waitForJob(jobId: string, timeoutMs: number = 60000): Promise<void> {
    console.log(`⏳ Waiting for job ${jobId} to complete...`)
    
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const jobStatus = await this.request<{
          status: string
          progress?: number
          error?: string
        }>('GET', `/api/v2/jobs/${jobId}`)
        
        if (jobStatus.status === 'completed') {
          console.log(`✅ Job ${jobId} completed successfully`)
          return
        }
        
        if (jobStatus.status === 'failed') {
          throw new Error(`Job ${jobId} failed: ${jobStatus.error || 'Unknown error'}`)
        }
        
        console.log(`⏳ Job ${jobId} status: ${jobStatus.status} (${jobStatus.progress || 0}%)`)
        
        // Wait 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (error) {
        console.error(`❌ Error checking job status:`, error)
        throw error
      }
    }
    
    throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`)
  }

  /**
   * Wait for enrichment to complete
   */
  async waitForEnrichment(listId: string, timeoutMs: number = 60000): Promise<void> {
    console.log(`⏳ Waiting for enrichment on list ${listId} to complete...`)
    
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const listStatus = await this.request<{
          enrichment_status: string
          enrichment_progress?: number
        }>('GET', `/api/v2/lead-lists/${listId}`)
        
        if (listStatus.enrichment_status === 'completed') {
          console.log(`✅ Enrichment on list ${listId} completed`)
          return
        }
        
        if (listStatus.enrichment_status === 'failed') {
          throw new Error(`Enrichment on list ${listId} failed`)
        }
        
        console.log(`⏳ Enrichment status: ${listStatus.enrichment_status} (${listStatus.enrichment_progress || 0}%)`)
        
        // Wait 3 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 3000))
        
      } catch (error) {
        console.error(`❌ Error checking enrichment status:`, error)
        throw error
      }
    }
    
    throw new Error(`Enrichment on list ${listId} timed out after ${timeoutMs}ms`)
  }

  /**
   * List leads from a list (paginated)
   */
  async* listLeads(params: {
    listId: string
    limit?: number
    starting_after?: string
  }): AsyncGenerator<InstantlyLead[], void, unknown> {
    let startingAfter = params.starting_after
    let hasMore = true
    
    while (hasMore) {
      const response = await this.getLeadsFromList(params.listId, {
        limit: params.limit || 50,
        starting_after: startingAfter
      })
      
      if (response.data.length === 0) {
        hasMore = false
      } else {
        yield response.data
        
        if (response.pagination?.has_more && response.pagination?.next_cursor) {
          startingAfter = response.pagination.next_cursor
        } else {
          hasMore = false
        }
      }
    }
  }

  /**
   * Search leads directly (fallback method)
   */
  async searchLeadsDirectly(params: {
    search: string
    filter?: string
    limit?: number
  }): Promise<LeadSearchResponse> {
    console.log(`🔍 Direct search with query: "${params.search}"`)
    
    return this.searchLeads({
      search: params.search,
      filter: params.filter as any || 'FILTER_VAL_UNCONTACTED',
      limit: params.limit || 50
    })
  }
}

// Export singleton instance
export const instantly = new InstantlyClient()

// Legacy interface for backward compatibility
export class InstantlyService extends InstantlyClient {
  async searchLeadsLegacy(params: {
    niche_or_job_title: string
    keywords?: string
    location?: string
    page?: number
    per_page?: number
  }): Promise<{
    data: InstantlyLead[]
    pagination: {
      current_page: number
      per_page: number
      total_pages: number
      total_count: number
      has_next_page: boolean
    }
  }> {
    console.log('🔍 Legacy searchLeads called - converting to new format')
    
    const keywords = params.keywords ? params.keywords.split(',').map(k => k.trim()) : []
    
    const response = await this.searchLeadsEnhanced({
      jobTitle: params.niche_or_job_title,
      location: params.location,
      keywords,
      limit: params.per_page || 50
    })

    // Convert to legacy format
    return {
      data: response.data,
      pagination: {
        current_page: params.page || 1,
        per_page: params.per_page || 50,
        total_pages: 1,
        total_count: response.data.length,
        has_next_page: false
      }
    }
  }
}
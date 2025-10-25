// src/lib/worker.ts
import { Worker, Job } from 'bullmq'
import type { Lead, Prisma } from '@prisma/client'
import { redis, LeadFetchJobData } from './queue'
import { prisma } from './prisma'
import { apollo, ApolloError, ApolloSearchFilters, ApolloLead, ApolloSearchResponse } from './apollo/apollo'
import { generateSmartLeadSummary } from './gemini'
import { generateLeadSummary, SheetLeadRow, sanitizeEmailForSheet, chunkArray } from './utils'
import { 
  createUserRateLimit, 
  createCampaignRateLimit, 
  RedisLock 
} from './rate-limit'

import { createAuthorizedClient } from './google-sheet/google-sheet'
import { writeLeadsToSheet } from './google-sheet/google-sheet-writer'

const parsedPreparationConcurrency = Number(process.env.LEAD_PREPARATION_CONCURRENCY || '5')
const LEAD_PREPARATION_CONCURRENCY = Number.isFinite(parsedPreparationConcurrency) && parsedPreparationConcurrency > 0
  ? Math.floor(parsedPreparationConcurrency)
  : 5
const parsedInsertBatchSize = Number(process.env.LEAD_INSERT_BATCH_SIZE || '500')
const LEAD_INSERT_BATCH_SIZE = Number.isFinite(parsedInsertBatchSize) && parsedInsertBatchSize >= 50
  ? Math.floor(parsedInsertBatchSize)
  : 500

type PreparedLead = {
  lookupKey: string
  dbData: Prisma.LeadCreateManyInput
  sheetRow: SheetLeadRow
}

export class LeadFetchWorker {
  private worker: Worker

  constructor() {
    this.worker = new Worker('lead-fetch', this.processJob.bind(this), {
      connection: redis,
      concurrency: 2, // Reduced concurrency for rate limiting
    })

    this.worker.on('completed', (job: any) => {
      console.log(`✅ Job ${job.id} completed successfully`)
    })

    this.worker.on('failed', (job: any, err: any) => {
      console.error(`❌ Job ${job?.id} failed:`, err.message)
    })
  }

  private async processJob(job: Job<LeadFetchJobData>): Promise<void> {
    const { campaignId, jobId, userId, isRetry } = job.data
    
    console.log(`🚀 Starting lead fetch job ${jobId} for campaign ${campaignId}${isRetry ? ' (RETRY)' : ''}`)

    // Set up rate limiters
    const userRateLimit = createUserRateLimit(userId)
    const campaignRateLimit = createCampaignRateLimit(campaignId)
    
    // Test connection to Apollo API
    try {
      const connected = await apollo.checkConnection()
      if (!connected) {
        throw new Error('Failed to connect to Apollo API')
      }
      console.log('✅ Connected to Apollo API')
    } catch (error) {
      console.error('❌ Apollo API connection failed:', error)
      throw new Error(`Apollo API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Acquire distributed lock to prevent concurrent execution
    const lock = new RedisLock(`campaign:${campaignId}`)
    const lockAcquired = await lock.acquire()

    if (!lockAcquired) {
      console.log(`⚠️ Cannot acquire lock for campaign ${campaignId} - another job may be running`)
      throw new Error(`Cannot acquire lock for campaign ${campaignId} - another job may be running`)
    }

    console.log(`🔒 Lock acquired for campaign ${campaignId}`)

    try {
      // Update job status to running
      await this.updateJobStatus(jobId, 'RUNNING', { startedAt: new Date() })

      // Get campaign details
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          user: {
            include: {
              googleTokens: true,
            },
          },
          googleSheet: true,
        },
      })

      if (!campaign) {
        console.warn(`⚠️ Campaign ${campaignId} no longer exists. Cancelling job ${jobId}.`)
        await this.cancelJobExecution(job, jobId, null, `Campaign ${campaignId} not found`)
        return
      }

      if (!campaign.isActive) {
        console.warn(`⏸️ Campaign ${campaignId} is inactive. Cancelling job ${jobId}.`)
        await this.cancelJobExecution(job, jobId, null, 'Campaign is paused')
        return
      }

      const googleToken = campaign.user.googleTokens
      if (!googleToken) {
        throw new Error(`No Google token found for user ${userId}`)
      }

      const attempt = await prisma.jobAttempt.create({
        data: {
          campaignJobId: jobId,
          attemptNumber: await this.getNextAttemptNumber(jobId),
          status: 'RUNNING',
        },
      })

      console.log(`📝 Created job attempt ${attempt.id} (attempt #${attempt.attemptNumber})`)

      console.log(`📋 Processing campaign: ${campaign.name}`)
      console.log(`📊 Target: ${campaign.nicheOrJobTitle} in ${campaign.location}`)
      console.log(`🔍 Keywords: ${campaign.keywords || 'none'}`)
      console.log(`📈 Max leads: ${campaign.maxLeads}`)

      // Set up rate limiters
      const userRateLimit = createUserRateLimit(userId)
      const campaignRateLimit = createCampaignRateLimit(campaignId)

      let totalLeadsProcessed = 0
      let totalLeadsWritten = 0

      // Parse job titles and locations from campaign
      const jobTitles = campaign.nicheOrJobTitle 
        ? campaign.nicheOrJobTitle.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : []

      const locations = campaign.location
        ? campaign.location.split(',').map(l => l.trim()).filter(l => l.length > 0)
        : []

      const includeDomains = campaign.includeDomains
        ? campaign.includeDomains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
        : []

      const excludeDomains = campaign.excludeDomains
        ? campaign.excludeDomains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
        : []

      console.log(`🔍 Job titles:`, jobTitles)
      console.log(`📍 Locations:`, locations)
      if (includeDomains.length > 0) {
        console.log(`✅ Including domains:`, includeDomains)
      }
      if (excludeDomains.length > 0) {
        console.log(`⛔ Excluding domains:`, excludeDomains)
      }

      let aggregatedLeads: Lead[] = []
      let aggregatedSheetRows: SheetLeadRow[] = []
      let pagesProcessed = 0
      let totalPagesReported = 0

      const modes: Array<'conserve' | 'balanced'> = campaign.searchMode === 'conserve'
        ? ['conserve', 'balanced']
        : ['balanced']

      for (const mode of modes) {
        const requestedPageSize = Math.max(1, Math.min(campaign.pageSize || 25, 100))
        const perPage = mode === 'conserve' ? Math.min(requestedPageSize, 15) : requestedPageSize
        const desiredMaxPages = Math.max(1, Math.ceil((campaign.maxLeads || perPage) / perPage))
        const maxPagesToFetch = mode === 'conserve'
          ? Math.min(20, Math.max(10, desiredMaxPages))
          : Math.min(50, Math.max(30, desiredMaxPages))
        const emptyPageThreshold = mode === 'conserve' ? 2 : 3

        const seenLeads = new Set<string>()
        const attemptLeads: Lead[] = []
        const attemptRows: SheetLeadRow[] = []

        let currentPage = 1
        let consecutiveEmptyPages = 0
        let attemptPagesProcessed = 0
        let attemptTotalPagesReported = 0

        console.log(`🎯 Fetching up to ${campaign.maxLeads} leads with page size ${perPage}`)
        console.log(`🛡️ Page fetch ceiling set to ${maxPagesToFetch} pages (${mode === 'conserve' ? 'credit saver' : 'balanced'} mode)`)

        while (attemptLeads.length < campaign.maxLeads) {
          const campaignStillActive = await this.verifyCampaignIsActive(campaignId, job, jobId, attempt.id, 'pagination loop')
          if (!campaignStillActive) {
            return
          }

          await this.checkRateLimits([userRateLimit, campaignRateLimit])

          const searchFilters: ApolloSearchFilters = {
            person_titles: jobTitles,
            person_locations: locations,
            keywords: campaign.keywords 
              ? campaign.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
              : undefined,
            page: currentPage,
            per_page: perPage,
          }

          console.log(`🔍 Apollo search (page ${currentPage}):`, JSON.stringify(searchFilters))

          const searchResponse = await this.executeApolloSearchWithRetry(searchFilters)
          const totalPages = searchResponse.pagination?.total_pages || currentPage
          attemptTotalPagesReported = Math.max(attemptTotalPagesReported, totalPages)
          attemptPagesProcessed += 1

          const leads = apollo.processLeads(searchResponse.people)
          console.log(`📊 Apollo returned ${leads.length} leads on page ${currentPage}`)

          if (leads.length === 0) {
            consecutiveEmptyPages += 1
            if (currentPage >= totalPages) {
              console.log(`⚠️ No more leads returned (page ${currentPage}), stopping pagination.`)
              break
            }
            if (consecutiveEmptyPages >= emptyPageThreshold) {
              console.log(`⚠️ Received empty responses for ${consecutiveEmptyPages} consecutive pages, stopping early to save credits.`)
              break
            }
            currentPage += 1
            continue
          }

          consecutiveEmptyPages = 0

          const filteredByDomain = leads.filter(lead => {
            const domain = (lead.domain || '').toLowerCase()

            if (includeDomains.length > 0 && (!domain || !includeDomains.some(d => domain.includes(d)))) {
              return false
            }

            if (excludeDomains.length > 0 && domain && excludeDomains.some(d => domain.includes(d))) {
              return false
            }

            return true
          })

          if (filteredByDomain.length !== leads.length) {
            console.log(`🧹 Domain filters removed ${leads.length - filteredByDomain.length} leads on page ${currentPage}`)
          }

          const remainingCapacity = Math.max(0, campaign.maxLeads - attemptLeads.length)
          const uniqueLeads = [] as ApolloLead[]

          for (const lead of filteredByDomain) {
            const rawEmail = lead.email?.toLowerCase().trim() || ''
            const dedupeKey = rawEmail && this.isValidEmail(rawEmail) && !rawEmail.includes('not_unlocked')
              ? rawEmail
              : `id:${lead.id}`
            if (seenLeads.has(dedupeKey)) {
              continue
            }
            seenLeads.add(dedupeKey)
            uniqueLeads.push(lead)
            if (uniqueLeads.length >= remainingCapacity) {
              break
            }
          }

          if (uniqueLeads.length === 0) {
            console.log(`⚠️ No new unique leads on page ${currentPage}`)
          } else {
            console.log(`🚀 Processing ${uniqueLeads.length} unique leads from page ${currentPage}`)
            const allowCrossCampaignDuplicates = mode === 'balanced' && modes.length > 1
            await this.enrichLeadsWithBulkMatch(uniqueLeads)
            const processedLeads = await this.processLeads(uniqueLeads, campaign.id, userId, allowCrossCampaignDuplicates)
            processedLeads.forEach(result => {
              attemptLeads.push(result.record)
              attemptRows.push(result.sheet)
            })
            totalLeadsProcessed = attemptLeads.length
            await this.updateProgress(job, attempt.id, currentPage, totalLeadsProcessed, totalLeadsWritten)
          }

          if (attemptLeads.length >= campaign.maxLeads) {
            console.log(`✅ Reached requested max leads (${campaign.maxLeads}).`)
            break
          }

          if (currentPage >= totalPages) {
            console.log(`🏁 Reached last available page (${totalPages}).`)
            break
          }

          if (currentPage >= maxPagesToFetch) {
            console.log(`🛑 Hit configured page limit of ${maxPagesToFetch}. Ending search to conserve credits.`)
            break
          }

          currentPage += 1
        }

        if (attemptLeads.length > 0) {
          aggregatedLeads = attemptLeads
          aggregatedSheetRows = attemptRows
          pagesProcessed = attemptPagesProcessed
          totalPagesReported = attemptTotalPagesReported
          break
        }

        if (mode === 'conserve') {
          console.log('ℹ️ Credit saver mode returned no leads; retrying with balanced coverage.')
          totalLeadsProcessed = 0
        }
      }

      totalLeadsProcessed = aggregatedLeads.length

      const activeAfterFetch = await this.verifyCampaignIsActive(campaignId, job, jobId, attempt.id, 'post-fetch')
      if (!activeAfterFetch) {
        return
      }

      if (aggregatedLeads.length === 0) {
        console.log('ℹ️ No leads matched the provided filters within the page limit.')

        await this.updateJobStatus(jobId, 'SUCCEEDED', {
          finishedAt: new Date(),
          totalPages: pagesProcessed,
          leadsProcessed: 0,
          leadsWritten: 0,
          lastError: null,
        })

        await this.updateAttemptStatus(attempt.id, 'SUCCEEDED', {
          finishedAt: new Date(),
          pagesProcessed,
          leadsFound: 0,
          leadsWritten: 0,
        })

        console.log('🏁 Campaign completed with zero leads found. User will see "No leads found" message.')
        return
      }

      const stillActiveBeforeWrite = await this.verifyCampaignIsActive(campaignId, job, jobId, attempt.id, 'before sheet write')
      if (!stillActiveBeforeWrite) {
        return
      }

      try {
        const oauth2Client = await createAuthorizedClient(
          googleToken.accessToken,
          googleToken.refreshToken
        )

        console.log(`📊 Writing ${aggregatedSheetRows.length} leads to Google Sheet: ${campaign.googleSheet.title}`)

        const writtenCount = await writeLeadsToSheet(
          oauth2Client,
          campaign.googleSheet.spreadsheetId,
          'Sheet1!A:P',
          aggregatedSheetRows
        )

        totalLeadsWritten = writtenCount
        console.log(`✅ Successfully wrote ${writtenCount} leads to Google Sheet`)
      } catch (sheetError) {
        console.error('❌ Failed to write leads to Google Sheet:', sheetError)
        await this.updateAttemptStatus(attempt.id, 'RUNNING', {
          error: `Sheet write failed: ${sheetError instanceof Error ? sheetError.message : 'Unknown error'}`
        })
      }

      console.log(`🏁 Campaign completed: ${totalLeadsProcessed} leads processed, ${totalLeadsWritten} written to sheet`)

      await this.updateJobStatus(jobId, 'SUCCEEDED', {
        finishedAt: new Date(),
        totalPages: totalPagesReported,
        leadsProcessed: totalLeadsProcessed,
        leadsWritten: totalLeadsWritten,
      })

      await this.updateAttemptStatus(attempt.id, 'SUCCEEDED', {
        finishedAt: new Date(),
        pagesProcessed,
        leadsFound: totalLeadsProcessed,
        leadsWritten: totalLeadsWritten,
      })

    } catch (error) {
      console.error(`❌ Job ${jobId} failed:`, error)
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      await this.updateJobStatus(jobId, 'FAILED', {
        finishedAt: new Date(),
        lastError: errorMessage,
      })

      // Update attempt record
      const attempts = await prisma.jobAttempt.findMany({
        where: { campaignJobId: jobId },
        orderBy: { attemptNumber: 'desc' },
        take: 1,
      })

      if (attempts[0]) {
        await this.updateAttemptStatus(attempts[0].id, 'FAILED', {
          finishedAt: new Date(),
          error: errorMessage,
        })
      }

      await job.discard()

      throw error // Re-throw to mark job as failed in BullMQ
    } finally {
      // Always release the lock
      await lock.release()
      console.log(`🔓 Released lock for campaign ${campaignId}`)
    }
  }

  private async checkRateLimits(rateLimiters: any[]): Promise<void> {
    for (const limiter of rateLimiters) {
      const result = await limiter.checkAndConsume(1)
      if (!result.allowed) {
        const waitTime = Math.max(1000, result.resetTime - Date.now())
        console.log(`⏳ Rate limit exceeded, waiting ${waitTime}ms`)
        await this.delay(waitTime)
      }
    }
  }

  private async executeApolloSearchWithRetry(filters: ApolloSearchFilters, attempt: number = 1): Promise<ApolloSearchResponse> {
    try {
      return await apollo.searchLeads(filters)
    } catch (error) {
      if (error instanceof ApolloError && error.shouldRetry && attempt < 5) {
        const waitTime = Math.min(15000, attempt * 2000)
        console.warn(`⚠️ Apollo rate limit/server issue (attempt ${attempt}). Retrying in ${waitTime}ms...`)
        await this.delay(waitTime)
        return this.executeApolloSearchWithRetry(filters, attempt + 1)
      }

      throw error
    }
  }

  private async enrichLeadsWithBulkMatch(leads: ApolloLead[]): Promise<void> {
    const targets = leads.filter(lead => {
      const email = lead.email ? lead.email.toLowerCase() : ''
      const needsEmail = !email || email.includes('not_unlocked')
      const needsPhone = !lead.phone
      return needsEmail || needsPhone
    })

    if (targets.length === 0) {
      return
    }

    try {
      const payload = targets.map(lead => ({
        identifier: lead.id,
        first_name: lead.first_name || undefined,
        last_name: lead.last_name || undefined,
        title: lead.title || undefined,
        organization_name: lead.company_name || undefined,
        domain: this.cleanDomain(lead.domain) || undefined,
        linkedin_url: lead.linkedin_url || undefined,
        email: lead.email && !lead.email.includes('not_unlocked') ? lead.email : undefined,
        city: lead.city || undefined,
        state: lead.state || undefined,
        country: lead.country || undefined,
      }))

      const response = await apollo.bulkMatchPeople(payload, {
        revealPersonalEmails: true,
        revealPhoneNumber: false,
      })

      const leadMap = new Map<string, ApolloLead>()
      leads.forEach(lead => {
        leadMap.set(lead.id, lead)
      })

      response.matches?.forEach(match => {
        const identifier = match?.client_identifier || match?.id
        if (!identifier) return

        const lead = leadMap.get(identifier)
        if (!lead) {
          return
        }

        const person = match
        const candidateEmails: string[] = []
        if (typeof person.email === 'string') candidateEmails.push(person.email)
        if (Array.isArray(person.emails)) {
          person.emails.forEach((entry: any) => {
            const val = entry?.value || entry?.email
            if (val) candidateEmails.push(String(val))
          })
        }
        if (Array.isArray(person.emails_raw)) {
          person.emails_raw.forEach((entry: any) => {
            if (typeof entry === 'string') candidateEmails.push(entry)
          })
        }

        const unlockedEmail = candidateEmails.find(email => email && !email.includes('not_unlocked'))
        if (unlockedEmail) {
          lead.email = unlockedEmail.toLowerCase().trim()
        }

        const candidatePhones: string[] = []
        if (typeof person.phone_number === 'string') candidatePhones.push(person.phone_number)
        if (typeof person.mobile_number === 'string') candidatePhones.push(person.mobile_number)
        if (Array.isArray(person.phone_numbers)) {
          person.phone_numbers.forEach((entry: any) => {
            if (typeof entry === 'string') {
              candidatePhones.push(entry)
            } else if (entry?.number) {
              candidatePhones.push(entry.number)
            }
          })
        }
        const phone = candidatePhones.find(num => typeof num === 'string' && num.trim().length > 0)
        if (phone) {
          lead.phone = phone.trim()
        }

        if (person.linkedin_url) {
          lead.linkedin_url = person.linkedin_url
        }

        if (person.organization?.name) {
          lead.company_name = person.organization.name
        }
        if (person.organization?.website_url) {
          lead.domain = person.organization.website_url
        }
        if (person.organization?.industry) {
          lead.industry = person.organization.industry
        }

        if (person.street_address) {
          lead.street_address = person.street_address
        }
        if (person.city) {
          lead.city = person.city
        }
        if (person.state) {
          lead.state = person.state
        }
        if (person.country) {
          lead.country = person.country
        }
        if (person.postal_code) {
          lead.postal_code = person.postal_code
        }
        if (person.formatted_address) {
          lead.formatted_address = person.formatted_address
        }
      })
    } catch (error) {
      console.error('❌ Bulk match enrichment failed:', error)
    }
  }

  private async cancelJobExecution(
    job: Job,
    jobId: string,
    attemptId: string | null,
    reason: string
  ): Promise<void> {
    const now = new Date()

    const existingProgress = typeof job.progress === 'object' && job.progress !== null
      ? job.progress as Record<string, unknown>
      : {}

    await job.updateProgress({
      ...existingProgress,
      status: 'cancelled',
      reason,
    })

    await this.updateJobStatus(jobId, 'CANCELLED', {
      finishedAt: now,
      lastError: reason,
      nextRunAt: null,
    })

    if (attemptId) {
      await this.updateAttemptStatus(attemptId, 'CANCELLED', {
        finishedAt: now,
        error: reason,
      })
    }
  }

  private async verifyCampaignIsActive(
    campaignId: string,
    job: Job,
    jobId: string,
    attemptId: string,
    context: string
  ): Promise<boolean> {
    const campaignState = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { isActive: true },
    })

    if (!campaignState) {
      console.warn(`⚠️ Campaign ${campaignId} removed during execution (${context}). Cancelling job.`)
      await this.cancelJobExecution(job, jobId, attemptId, `Campaign removed during ${context}`)
      return false
    }

    if (!campaignState.isActive) {
      console.warn(`⏸️ Campaign ${campaignId} paused during execution (${context}). Cancelling job.`)
      await this.cancelJobExecution(job, jobId, attemptId, `Campaign paused during ${context}`)
      return false
    }

    return true
  }

  private async processLeads(
    leads: ApolloLead[],
    campaignId: string,
    userId: string,
    allowCrossCampaignDuplicates: boolean = false
  ): Promise<Array<{ record: Lead; sheet: SheetLeadRow }>> {
    if (leads.length === 0) {
      return []
    }

    const prepared = await this.prepareLeads(leads, campaignId, userId, allowCrossCampaignDuplicates)

    if (prepared.length === 0) {
      console.log('ℹ️ No leads passed preparation after enrichment and validation checks.')
      return []
    }

    const deduped = this.dedupePreparedLeads(prepared)
    const toInsert = await this.filterExistingLeads(deduped, campaignId, userId, allowCrossCampaignDuplicates)

    if (toInsert.length === 0) {
      console.log('ℹ️ All prepared leads already exist for this user/campaign. Skipping insert.')
      return []
    }

    const insertedEmailSet = new Set<string>()

    for (const batch of chunkArray(toInsert, LEAD_INSERT_BATCH_SIZE)) {
      const payload = batch.map(item => ({ ...item.dbData }))
      const result = await prisma.lead.createMany({
        data: payload,
        skipDuplicates: true,
      })

      payload.forEach(item => {
        if (item.email) {
          insertedEmailSet.add(item.email)
        }
      })

      if (result.count !== payload.length) {
        console.warn(`⚠️ createMany skipped ${payload.length - result.count} lead(s) due to duplicates or race conditions.`)
      }
    }

    if (insertedEmailSet.size === 0) {
      console.log('ℹ️ No new leads were inserted after deduplication. Skipping sheet write.')
      return []
    }

    const insertedEmails = Array.from(insertedEmailSet)
    const persistedRecords = await this.fetchLeadsByEmails(insertedEmails, campaignId)
    const recordMap = new Map(persistedRecords.map(record => [record.email, record]))

    const processed = toInsert
      .map(item => {
        const email = item.dbData.email
        if (!email) {
          return null
        }
        const record = recordMap.get(email)
        if (!record) {
          console.warn(`⚠️ Could not load lead record for email ${email} after insertion.`)
          return null
        }
        return { record, sheet: item.sheetRow }
      })
      .filter((value): value is { record: Lead; sheet: SheetLeadRow } => Boolean(value))

    console.log(`📊 Successfully processed ${processed.length} out of ${leads.length} leads`)
    return processed
  }

  private async prepareLeads(
    leads: ApolloLead[],
    campaignId: string,
    userId: string,
    allowCrossCampaignDuplicates: boolean
  ): Promise<PreparedLead[]> {
    const results = await this.mapWithConcurrency(
      leads,
      LEAD_PREPARATION_CONCURRENCY,
      async (lead) => {
        try {
          return await this.prepareLead(lead, campaignId, userId, allowCrossCampaignDuplicates)
        } catch (error) {
          console.error(`❌ Error preparing lead ${lead.id}:`, error)
          return null
        }
      }
    )

    return results.filter((value): value is PreparedLead => Boolean(value))
  }

  private dedupePreparedLeads(prepared: PreparedLead[]): PreparedLead[] {
    if (prepared.length <= 1) {
      return prepared
    }

    const seen = new Set<string>()
    const unique: PreparedLead[] = []

    for (const item of prepared) {
      if (seen.has(item.lookupKey)) {
        continue
      }
      seen.add(item.lookupKey)
      unique.push(item)
    }

    if (unique.length !== prepared.length) {
      console.log(`ℹ️ Removed ${prepared.length - unique.length} duplicate lead(s) during in-memory deduplication.`)
    }

    return unique
  }

  private async filterExistingLeads(
    prepared: PreparedLead[],
    campaignId: string,
    userId: string,
    allowCrossCampaignDuplicates: boolean
  ): Promise<PreparedLead[]> {
    if (prepared.length === 0) {
      return []
    }

    const scopeFilter = allowCrossCampaignDuplicates
      ? { campaignId }
      : { userId }

    const emailSet = new Set<string>()
    prepared.forEach(item => {
      if (item.dbData.email) {
        emailSet.add(item.dbData.email)
      }
    })

    if (emailSet.size === 0) {
      return []
    }

    const existingEmails = new Set<string>()

    for (const chunk of chunkArray(Array.from(emailSet), 500)) {
      const matches = await prisma.lead.findMany({
        where: {
          ...scopeFilter,
          email: {
            in: chunk,
          },
        },
        select: { email: true },
      })

      matches.forEach(match => existingEmails.add(match.email))
    }

    if (existingEmails.size === 0) {
      return prepared
    }

    const filtered = prepared.filter(item => !existingEmails.has(item.dbData.email || ''))

    if (filtered.length !== prepared.length) {
      console.log(`ℹ️ Skipped ${prepared.length - filtered.length} database duplicate lead(s).`)
    }

    return filtered
  }

  private async fetchLeadsByEmails(emails: string[], campaignId: string): Promise<Lead[]> {
    if (!emails.length) {
      return []
    }

    const uniqueEmails = Array.from(new Set(emails))
    const records: Lead[] = []

    for (const chunk of chunkArray(uniqueEmails, 500)) {
      const chunkRecords = await prisma.lead.findMany({
        where: {
          campaignId,
          email: {
            in: chunk,
          },
        },
      })
      records.push(...chunkRecords)
    }

    return records
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    if (items.length === 0) {
      return []
    }

    const cappedConcurrency = Math.max(1, Math.min(concurrency, items.length))
    const results: R[] = new Array(items.length)
    let nextIndex = 0

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex
        if (currentIndex >= items.length) {
          break
        }
        nextIndex += 1
        results[currentIndex] = await mapper(items[currentIndex], currentIndex)
      }
    }

    await Promise.all(Array.from({ length: cappedConcurrency }, () => worker()))
    return results
  }

  private async prepareLead(
    lead: ApolloLead,
    campaignId: string,
    userId: string,
    allowCrossCampaignDuplicates: boolean
  ): Promise<PreparedLead | null> {
    let rawEmail = lead.email ? lead.email.toLowerCase().trim() : ''

    if (!rawEmail || rawEmail.includes('not_unlocked')) {
      const revealed = await apollo.revealEmail(lead.id)
      if (revealed) {
        rawEmail = revealed.toLowerCase().trim()
        lead.email = rawEmail
        console.log(`🔓 Revealed email for ${lead.first_name} ${lead.last_name}: ${rawEmail}`)
      }
    }

    const hasValidEmail = !!rawEmail && this.isValidEmail(rawEmail) && !rawEmail.includes('not_unlocked')
    const normalizedEmail = hasValidEmail ? rawEmail : `${lead.id.toLowerCase()}@locked.apollo`

    if (!hasValidEmail) {
      console.log(`⚠️ Email marked as locked or invalid, will blank in sheet output: ${lead.email}`)
    }

    const phone = lead.phone ? lead.phone.toString().trim() : ''
    const streetAddress = lead.street_address ? lead.street_address.toString().trim() : ''
    const city = lead.city ? lead.city.toString().trim() : ''
    const state = lead.state ? lead.state.toString().trim() : ''
    const country = lead.country ? lead.country.toString().trim() : ''
    const postalCode = lead.postal_code ? lead.postal_code.toString().trim() : ''
    const formattedAddress = lead.formatted_address ? lead.formatted_address.toString().trim() : ''

    const summary = (await this.createLeadSummary(lead)).trim() || 'Summary unavailable.'
    const finalSummary = hasValidEmail
      ? summary
      : `${summary}\nEmail address is locked in Apollo. Unlock the contact to access the email.`

    const website = this.cleanUrl(lead.domain)
    const linkedinUrl = this.cleanUrl(lead.linkedin_url)
    const domain = this.cleanDomain(lead.domain)
    const location = this.cleanString(
      formattedAddress || [city, state, country].filter(Boolean).join(', ')
    )

    const dbData: Prisma.LeadCreateManyInput = {
      userId,
      campaignId,
      email: normalizedEmail,
      firstName: this.cleanString(lead.first_name) ?? null,
      lastName: this.cleanString(lead.last_name) ?? null,
      company: this.cleanString(lead.company_name) ?? null,
      jobTitle: this.cleanString(lead.title) ?? null,
      website: website ?? null,
      linkedinUrl: linkedinUrl ?? null,
      summary: finalSummary,
      location: location ?? null,
      industry: this.cleanString(lead.industry || null) ?? null,
      domain: domain ?? null,
      tags: [],
      source: 'apollo',
      isValid: hasValidEmail,
      isSuppressed: false,
    }

    const sheetRow: SheetLeadRow = {
      email: sanitizeEmailForSheet(hasValidEmail ? rawEmail : null),
      firstName: dbData.firstName || '',
      lastName: dbData.lastName || '',
      phone,
      company: dbData.company || '',
      jobTitle: dbData.jobTitle || '',
      website: dbData.website || '',
      linkedinUrl: dbData.linkedinUrl || '',
      industry: dbData.industry || '',
      streetAddress,
      city,
      state,
      country,
      postalCode,
      formattedAddress,
      summary: finalSummary,
    }

    return {
      lookupKey: this.buildLookupKey(campaignId, userId, normalizedEmail, allowCrossCampaignDuplicates),
      dbData,
      sheetRow,
    }
  }

  private buildLookupKey(
    campaignId: string,
    userId: string,
    email: string,
    allowCrossCampaignDuplicates: boolean
  ): string {
    return allowCrossCampaignDuplicates ? `${campaignId}:${email}` : `${userId}:${email}`
  }

  private async createLeadSummary(lead: ApolloLead): Promise<string> {
    try {
      return await generateSmartLeadSummary({
        firstName: lead.first_name,
        lastName: lead.last_name,
        title: lead.title,
        company: lead.company_name,
        domain: lead.domain,
        email: lead.email,
        linkedinUrl: lead.linkedin_url,
      })
    } catch (error) {
      console.error('Gemini summary helper failed, using fallback:', error)
      return generateLeadSummary(lead)
    }
  }

  private cleanString(str: string | null | undefined): string | null {
    if (!str) return null
    const cleaned = str.toString().trim()
    return cleaned.length > 0 ? cleaned : null
  }

  private cleanDomain(domain: string | null | undefined): string | null {
    if (!domain) return null
    let value = domain.toString().trim().toLowerCase()

    if (!value) {
      return null
    }

    try {
      const parsed = new URL(value.includes('://') ? value : `https://${value}`)
      value = parsed.hostname
    } catch {
      // If parsing fails, fallback to raw value without protocol/path
      const stripped = value.replace(/^https?:\/\//, '').split('/')[0]
      value = stripped
    }

    return value.replace(/^www\./, '') || null
  }

  private cleanUrl(url: string | null | undefined): string | null {
    if (!url) return null
    let cleaned = url.toString().trim()
    
    // Add protocol if missing
    if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = 'https://' + cleaned
    }
    
    // Basic URL validation
    try {
      new URL(cleaned)
      return cleaned
    } catch {
      return null
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  private async updateJobStatus(jobId: string, status: string, updates: any = {}) {
    return prisma.campaignJob.update({
      where: { id: jobId },
      data: {
        status: status as any,
        ...updates,
      },
    })
  }

  private async updateAttemptStatus(attemptId: string, status: string, updates: any = {}) {
    return prisma.jobAttempt.update({
      where: { id: attemptId },
      data: {
        status: status as any,
        ...updates,
      },
    })
  }

  private async updateProgress(job: Job, attemptId: string, page: number, processed: number, written: number) {
    // Update job progress for UI
    await job.updateProgress({
      page,
      leadsProcessed: processed,
      leadsWritten: written,
      status: 'processing'
    })

    // Persist progress on the campaign job for dashboard visibility
    const jobId = job.data.jobId
    if (jobId) {
      await prisma.campaignJob.update({
        where: { id: jobId },
        data: {
          status: 'RUNNING',
          totalPages: Math.max(page, 1),
          leadsProcessed: processed,
          leadsWritten: written,
        },
      })
    }

    // Update attempt record
    await prisma.jobAttempt.update({
      where: { id: attemptId },
      data: {
        pagesProcessed: page,
        leadsFound: processed,
        leadsWritten: written,
      },
    })

    console.log(`📊 Progress updated: Page ${page}, Processed ${processed}, Written ${written}`)
  }

  private async getNextAttemptNumber(jobId: string): Promise<number> {
    const lastAttempt = await prisma.jobAttempt.findFirst({
      where: { campaignJobId: jobId },
      orderBy: { attemptNumber: 'desc' },
    })

    return (lastAttempt?.attemptNumber || 0) + 1
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async close(): Promise<void> {
    console.log('🛑 Closing lead fetch worker...')
    await this.worker.close()
  }
}

// Export singleton worker instance
let worker: LeadFetchWorker | null = null

export function startWorker(): LeadFetchWorker {
  if (!worker) {
    console.log('🚀 Starting lead fetch worker...')
    worker = new LeadFetchWorker()
    console.log('✅ Lead fetch worker started successfully')
  }
  return worker
}

export function stopWorker(): Promise<void> {
  if (worker) {
    console.log('🛑 Stopping lead fetch worker...')
    return worker.close()
  }
  return Promise.resolve()
}

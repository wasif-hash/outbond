// src/lib/worker.ts (REPLACE EXISTING)
import { Worker, Job } from 'bullmq'
import { redis, LeadFetchJobData } from './queue'
import { prisma } from './prisma'
import { InstantlyClient, InstantlyError, InstantlyLead } from './instantly'
import { 
  globalInstantlyRateLimit, 
  createUserRateLimit, 
  createCampaignRateLimit, 
  RedisLock 
} from './rate-limit'

import { createAuthorizedClient } from './google-sheet'
import { writeLeadsToSheet } from './google-sheet-writer'

export class LeadFetchWorker {
  private worker: Worker

  constructor() {
    this.worker = new Worker('lead-fetch', this.processJob.bind(this), {
      connection: redis,
      concurrency: 3, // Reduced concurrency to avoid rate limits
    })

    this.worker.on('completed', (job: any) => {
      console.log(`Job ${job.id} completed successfully`)
    })

    this.worker.on('failed', (job: any, err: any) => {
      console.error(`Job ${job?.id} failed:`, err.message)
    })
  }

  private async processJob(job: Job<LeadFetchJobData>): Promise<void> {
    const { campaignId, jobId, userId } = job.data
    
    console.log(`🚀 Starting lead fetch job ${jobId} for campaign ${campaignId}`)

    // Acquire distributed lock to prevent concurrent execution
    const lock = new RedisLock(`campaign:${campaignId}`)
    const lockAcquired = await lock.acquire()

    if (!lockAcquired) {
      console.log(`⚠️ Cannot acquire lock for campaign ${campaignId} - another job may be running`)
      throw new Error(`Cannot acquire lock for campaign ${campaignId} - another job may be running`)
    }

    console.log(`✅ Lock acquired for campaign ${campaignId}`)

    try {
      // Update job status to running
      await this.updateJobStatus(jobId, 'RUNNING', { startedAt: new Date() })

      // Create job attempt record
      const attempt = await prisma.jobAttempt.create({
        data: {
          campaignJobId: jobId,
          attemptNumber: await this.getNextAttemptNumber(jobId),
          status: 'RUNNING',
        },
      })

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
        throw new Error(`Campaign ${campaignId} not found`)
      }

      if (!campaign.user.googleTokens[0]) {
        throw new Error(`No Google token found for user ${userId}`)
      }

      // Set up rate limiters
      const userRateLimit = createUserRateLimit(userId)
      const campaignRateLimit = createCampaignRateLimit(campaignId)

      // Initialize the Instantly client
      const instantlyClient = new InstantlyClient()
      
      console.log(`🔍 Starting lead search for campaign: ${campaign.name}`)
      
      let totalLeadsProcessed = 0
      let totalLeadsWritten = 0
      let currentPage = 1
      let hasMoreLeads = true
      let startingAfter: string | undefined = undefined

      // Build search query from campaign parameters
      const searchTerms = []
      searchTerms.push(campaign.nicheOrJobTitle)
      
      if (campaign.location) {
        searchTerms.push(campaign.location)
      }
      
      if (campaign.keywords) {
        const keywords = campaign.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
        searchTerms.push(...keywords)
      }
      
      const searchQuery = searchTerms.join(' ')
      console.log(`🔍 Search query: "${searchQuery}"`)

      // Main lead fetching loop
      while (hasMoreLeads && totalLeadsProcessed < campaign.maxLeads) {
        // Check rate limits before each request
        await this.checkRateLimits([globalInstantlyRateLimit, userRateLimit, campaignRateLimit])

        // Add delay between requests to respect rate limits
        if (currentPage > 1) {
          console.log(`⏳ Waiting 3 seconds before next request...`)
          await this.delay(3000)
        }

        try {
          console.log(`📄 Fetching page ${currentPage}...`)
          
          const response = await instantlyClient.searchLeads({
            search: searchQuery,
            filter: 'FILTER_VAL_UNCONTACTED',
            limit: Math.min(campaign.pageSize, campaign.maxLeads - totalLeadsProcessed),
            starting_after: startingAfter
          })

          const leads = response.data || []
          console.log(`📄 Page ${currentPage}: Found ${leads.length} leads`)

          if (leads.length === 0) {
            console.log(`📄 No more leads found, ending search`)
            hasMoreLeads = false
            break
          }

          // Process and save leads to database
          const processedLeads = await this.processLeads(leads, campaign.id, userId)
          console.log(`✅ Processed ${processedLeads.length} unique leads from page ${currentPage}`)
          
          totalLeadsProcessed += leads.length

          // Write to Google Sheet if we have processed leads
          if (processedLeads.length > 0) {
            try {
              const googleToken = campaign.user.googleTokens[0]
              const oauth2Client = await createAuthorizedClient(
                googleToken.accessToken,
                googleToken.refreshToken
              )

              console.log(`📊 Writing ${processedLeads.length} leads to Google Sheet`)
              
              const writtenCount = await writeLeadsToSheet(
                oauth2Client,
                campaign.googleSheet.spreadsheetId,
                'Sheet1!A:Z',
                processedLeads
              )

              totalLeadsWritten += writtenCount
              console.log(`✅ Successfully wrote ${writtenCount} leads to Google Sheet`)
            } catch (sheetError) {
              console.error('❌ Failed to write leads to Google Sheet:', sheetError)
              // Don't throw - continue processing
            }
          }

          // Update progress
          await this.updateProgress(job, attempt.id, currentPage, totalLeadsProcessed, totalLeadsWritten)

          // Check pagination
          if (response.pagination?.has_more && response.pagination?.next_cursor) {
            startingAfter = response.pagination.next_cursor
            currentPage++
          } else {
            hasMoreLeads = false
          }

          // Check if we've reached the maximum leads limit
          if (totalLeadsProcessed >= campaign.maxLeads) {
            console.log(`📊 Reached maximum leads limit: ${campaign.maxLeads}`)
            hasMoreLeads = false
          }

        } catch (searchError) {
          console.error(`❌ Error on page ${currentPage}:`, searchError)

          if (searchError instanceof InstantlyError) {
            if (searchError.isRateLimited) {
              // Wait longer for rate limiting
              const backoffDelay = Math.min(60000, 5000 * Math.pow(2, currentPage - 1))
              console.log(`⏳ Rate limited, waiting ${backoffDelay}ms before retry`)
              await this.delay(backoffDelay)
              continue // Retry the same page
            } else if (!searchError.shouldRetry) {
              // Non-retryable error
              throw searchError
            }
          }
          
          // For other errors, try to continue with exponential backoff
          const retryDelay = Math.min(30000, 2000 * Math.pow(2, currentPage - 1))
          console.log(`⏳ Error encountered, waiting ${retryDelay}ms before retry`)
          await this.delay(retryDelay)
          
          // If we've tried this page multiple times, move on
          if (currentPage > 5) {
            throw searchError
          }
        }
      }

      // Final status update
      console.log(`🏁 Campaign completed: ${totalLeadsProcessed} leads processed, ${totalLeadsWritten} written to sheet`)

      // Mark job as completed
      await this.updateJobStatus(jobId, 'SUCCEEDED', {
        finishedAt: new Date(),
        totalPages: currentPage,
        leadsProcessed: totalLeadsProcessed,
        leadsWritten: totalLeadsWritten,
      })

      await this.updateAttemptStatus(attempt.id, 'SUCCEEDED', {
        finishedAt: new Date(),
        pagesProcessed: currentPage,
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
        const waitTime = result.resetTime - Date.now()
        if (waitTime > 0) {
          console.log(`⏳ Rate limit exceeded, waiting ${waitTime}ms`)
          await this.delay(waitTime)
        }
      }
    }
  }

  private async processLeads(leads: InstantlyLead[], campaignId: string, userId: string) {
    const processedLeads = []

    for (const lead of leads) {
      try {
        // Validate email
        if (!lead.email || !this.isValidEmail(lead.email)) {
          console.log(`⚠️ Skipping invalid email: ${lead.email}`)
          continue
        }

        // Check for duplicates
        const existing = await prisma.lead.findFirst({
          where: {
            email: lead.email,
            campaignId: campaignId,
          },
        })

        if (existing) {
          console.log(`⚠️ Duplicate lead found: ${lead.email}`)
          continue
        }

        // Create lead record
        const leadRecord = await prisma.lead.create({
          data: {
            userId,
            campaignId,
            email: lead.email,
            firstName: lead.first_name || null,
            lastName: lead.last_name || null,
            phone: lead.phone || null,
            company: lead.company || null,
            jobTitle: lead.job_title || null,
            website: lead.website || null,
            linkedinUrl: lead.linkedin_url || null,
            industry: lead.industry || null,
            location: lead.location || null,
            tags: lead.tags || [],
            source: 'instantly',
          },
        })

        processedLeads.push(leadRecord)
      } catch (leadError) {
        console.error(`❌ Error processing lead ${lead.email}:`, leadError)
        // Continue with next lead
      }
    }

    return processedLeads
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
    })

    // Update attempt record
    await prisma.jobAttempt.update({
      where: { id: attemptId },
      data: {
        pagesProcessed: page,
        leadsFound: processed,
        leadsWritten: written,
      },
    })
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
    await this.worker.close()
  }
}

// Export singleton worker instance
let worker: LeadFetchWorker | null = null

export function startWorker(): LeadFetchWorker {
  if (!worker) {
    worker = new LeadFetchWorker()
  }
  return worker
}

export function stopWorker(): Promise<void> {
  if (worker) {
    return worker.close()
  }
  return Promise.resolve()
}
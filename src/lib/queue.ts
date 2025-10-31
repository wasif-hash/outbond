// src/lib/queue.ts
import { Queue, Job } from 'bullmq'
import type { JobsOptions, JobType } from 'bullmq'
import Redis from 'ioredis'

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // BullMQ requires this to be null
  lazyConnect: true,
})

export interface LeadFetchJobData {
  campaignId: string
  jobId: string
  userId: string
  isRetry?: boolean
}

export interface EmailSendQueueData {
  jobId: string
  userId: string
  gmailAccountId: string
}

// Job queue for lead fetching
export const leadFetchQueue = new Queue('lead-fetch', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50, // Keep last 50 completed jobs
    removeOnFail: 100, // Keep last 100 failed jobs
    attempts: 1,
  },
})

export const emailSendQueue = new Queue('email-send', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 200,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
})

// Enqueue a job
export async function enqueueJob(
  jobName: string,
  data: LeadFetchJobData,
  options: JobsOptions = {},
): Promise<Job> {
  return leadFetchQueue.add(jobName, data, {
    // Delay job to prevent immediate execution and allow for spacing
    delay: options.delay || 1000,
    ...options,
  })
}

export async function enqueueEmailSendJob(
  data: EmailSendQueueData,
  options: JobsOptions = {},
): Promise<Job> {
  return emailSendQueue.add('email-send', data, {
    delay: options.delay || 0,
    ...options,
  })
}

export async function removePendingCampaignJobs(campaignId: string): Promise<number> {
  const jobStates: JobType[] = ['wait', 'delayed', 'paused', 'prioritized', 'waiting-children']
  const jobs = await leadFetchQueue.getJobs(jobStates)
  let removed = 0

  for (const job of jobs) {
    if (job?.data?.campaignId === campaignId) {
      await job.remove()
      removed += 1
    }
  }

  return removed
}

// Get job status
export async function getJobStatus(jobId: string) {
  const job = await Job.fromId(leadFetchQueue, jobId)
  if (!job) return null

  return {
    id: job.id,
    name: job.name,
    data: job.data,
    progress: job.progress,
    returnValue: job.returnvalue,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    opts: job.opts,
  }
}

// Cleanup old jobs
export async function cleanupJobs() {
  await leadFetchQueue.clean(24 * 60 * 60 * 1000, 100, 'completed') // Clean completed jobs older than 1 day
  await leadFetchQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed') // Clean failed jobs older than 7 days
}

export { redis }

// src/lib/queue.ts
import { Queue, Worker, Job } from 'bullmq'
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

// Job queue for lead fetching
export const leadFetchQueue = new Queue('lead-fetch', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50, // Keep last 50 completed jobs
    removeOnFail: 100, // Keep last 100 failed jobs
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000, // Start with 3 second delay
    },
  },
})

// Enqueue a job
export async function enqueueJob(
  jobName: string,
  data: LeadFetchJobData,
  options: any = {}
): Promise<Job> {
  return leadFetchQueue.add(jobName, data, {
    // Delay job to prevent immediate execution and allow for spacing
    delay: options.delay || 1000,
    ...options,
  })
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
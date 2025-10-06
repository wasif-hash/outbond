import { Worker, Job } from 'bullmq'

import { emailSendQueue, redis, type EmailSendQueueData } from '@/lib/queue'
import { prisma } from '@/lib/prisma'
import { sendGmailMessage, ensureFreshGmailToken } from '@/lib/google-gmail'
import { createEmailSendRateLimit } from '@/lib/rate-limit'

const EMAIL_STATUS = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  SENDING: 'SENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const

type EmailStatus = typeof EMAIL_STATUS[keyof typeof EMAIL_STATUS]

const db = prisma as any

export class EmailSendWorker {
  private worker: Worker

  constructor() {
    this.worker = new Worker(
      emailSendQueue.name,
      this.processJob.bind(this),
      {
        connection: redis,
        concurrency: Number(process.env.EMAIL_SEND_CONCURRENCY || '2'),
      },
    )

    this.worker.on('completed', (job) => {
      console.log(`✉️ Email job ${job.id} sent successfully`)
    })

    this.worker.on('failed', (job, err) => {
      console.error(`📮 Email job ${job?.id} failed:`, err?.message)
    })
  }

  private async processJob(job: Job<EmailSendQueueData>) {
    const { jobId, userId, gmailAccountId } = job.data

    const emailJob = await db.emailSendJob.findUnique({
      where: { id: jobId },
      include: {
        gmailAccount: true,
      },
    })

    if (!emailJob) {
      console.warn(`Email send job ${jobId} missing, skipping`)
      return
    }

    if (emailJob.status !== EMAIL_STATUS.PENDING && emailJob.status !== EMAIL_STATUS.QUEUED) {
      console.warn(`Email send job ${jobId} already processed with status ${emailJob.status}`)
      return
    }

    const gmailAccount = emailJob.gmailAccount
    if (!gmailAccount || gmailAccount.id !== gmailAccountId) {
      await db.emailSendJob.update({
        where: { id: jobId },
        data: {
          status: EMAIL_STATUS.FAILED,
          error: 'Gmail account missing or mismatched',
        },
      })
      throw new Error('Gmail account missing or mismatched')
    }

    const limiter = createEmailSendRateLimit(userId)
    const check = await limiter.checkAndConsume(1)
    if (!check.allowed) {
      const delayMs = Math.max(1000, check.resetTime - Date.now())
      console.log(`Email rate limit reached for user ${userId}, delaying ${delayMs}ms`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    await db.emailSendJob.update({
      where: { id: jobId },
      data: {
        status: EMAIL_STATUS.SENDING,
        error: null,
      },
    })

    try {
      const freshAccount = await ensureFreshGmailToken(gmailAccount)
      const messageId = await sendGmailMessage(freshAccount, {
        to: emailJob.leadEmail,
        subject: emailJob.subject,
        htmlBody: emailJob.bodyHtml,
        textBody: emailJob.bodyText || undefined,
      })

      await db.emailSendJob.update({
        where: { id: jobId },
        data: {
          status: EMAIL_STATUS.SENT,
          sentAt: new Date(),
          error: null,
          sheetRowRef: emailJob.sheetRowRef || messageId,
        },
      })
    } catch (error) {
      console.error('Failed to send Gmail message:', error)
      const errMsg = error instanceof Error ? error.message : 'Unknown Gmail error'
      await db.emailSendJob.update({
        where: { id: jobId },
        data: {
          status: EMAIL_STATUS.FAILED,
          error: errMsg,
        },
      })
      throw error
    }
  }

  async close(): Promise<void> {
    console.log('Closing email send worker...')
    await this.worker.close()
  }
}

let emailWorker: EmailSendWorker | null = null

export function startEmailWorker(): EmailSendWorker {
  if (!emailWorker) {
    console.log('Starting email send worker...')
    emailWorker = new EmailSendWorker()
  }
  return emailWorker
}

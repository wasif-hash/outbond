import { NextRequest, NextResponse } from 'next/server'

import { verifyAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enqueueEmailSendJob } from '@/lib/queue'

const MAX_JOBS_PER_REQUEST = 200

const EMAIL_STATUS = {
  QUEUED: 'QUEUED',
} as const

interface SendJobInput {
  email: string
  subject: string
  bodyHtml: string
  bodyText?: string
  sheetRowRef?: string
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  summary?: string | null
  campaignId?: string | null
}

const db = prisma as any

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null) as {
    jobs?: SendJobInput[]
  } | null

  if (!payload || !Array.isArray(payload.jobs) || payload.jobs.length === 0) {
    return NextResponse.json({ error: 'No email jobs supplied' }, { status: 400 })
  }

  if (payload.jobs.length > MAX_JOBS_PER_REQUEST) {
    return NextResponse.json({ error: `Too many jobs; maximum ${MAX_JOBS_PER_REQUEST}` }, { status: 400 })
  }

  const gmailAccount = await db.gmailAccount.findUnique({ where: { userId: authResult.user.userId } })
  if (!gmailAccount) {
    return NextResponse.json({ error: 'Gmail account not connected' }, { status: 409 })
  }

  const sanitizedJobs = payload.jobs
    .filter((job) => job?.email && job?.subject && job?.bodyHtml)
    .map((job) => ({
      ...job,
      email: job.email.trim().toLowerCase(),
      subject: job.subject.trim().slice(0, 180),
      bodyHtml: job.bodyHtml.trim(),
      bodyText: job.bodyText?.trim()?.slice(0, 2000),
    }))

  if (sanitizedJobs.length === 0) {
    return NextResponse.json({ error: 'No valid email jobs supplied' }, { status: 400 })
  }

  const createdJobs: string[] = []

  await prisma.$transaction(async (tx) => {
    for (const job of sanitizedJobs) {
      const record = await (tx as any).emailSendJob.create({
        data: {
          userId: authResult.user!.userId,
          campaignId: job.campaignId || undefined,
          gmailAccountId: gmailAccount.id,
          leadEmail: job.email,
          leadFirstName: job.firstName,
          leadLastName: job.lastName,
          leadCompany: job.company,
          leadSummary: job.summary,
          sheetRowRef: job.sheetRowRef,
          subject: job.subject,
          bodyHtml: job.bodyHtml,
          bodyText: job.bodyText,
          status: EMAIL_STATUS.QUEUED,
        },
      })
      createdJobs.push(record.id)
    }
  })

  await Promise.all(
    createdJobs.map((id) =>
      enqueueEmailSendJob({
        jobId: id,
        userId: authResult.user!.userId,
        gmailAccountId: gmailAccount.id,
      }),
    ),
  )

  return NextResponse.json({
    success: true,
    queued: createdJobs.length,
    jobIds: createdJobs,
  })
}

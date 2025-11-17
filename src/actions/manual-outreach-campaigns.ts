'use server'

import { unstable_cache } from 'next/cache'
import type { EmailSendStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { DraftStatus, ManualOutreachSource, OutreachedJob } from '@/types/outreach'
import type { PersistedWorkflowState } from '@/types/outreach-workflow'

export type ManualOutreachCampaignMetrics = {
  totalEmails: number
  sent: number
  queued: number
  pending: number
  sending: number
  failed: number
  cancelled: number
  drafts: number
}

export type ManualOutreachCampaignDetail = {
  campaign: {
    id: string
    name: string
    source: ManualOutreachSource | null
    createdAt: string | null
    updatedAt: string | null
    firstSentAt: string | null
    lastSentAt: string | null
    totalEmails: number
  }
  metrics: ManualOutreachCampaignMetrics
  emails: OutreachedJob[]
}

const EMAIL_STATUSES: EmailSendStatus[] = ['PENDING', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED']

const mapDraftStatusToJobStatus = (status: DraftStatus | undefined): string => {
  switch (status) {
    case 'queued':
      return 'QUEUED'
    case 'sent':
      return 'SENT'
    case 'failed':
      return 'FAILED'
    default:
      return 'DRAFT'
  }
}

const fetchManualOutreachCampaignDetail = async (
  campaignId: string,
  userId: string,
): Promise<ManualOutreachCampaignDetail | null> => {
  const where = { manualCampaignId: campaignId, userId }

  const [jobCount, manualDraftRecord] = await Promise.all([
    prisma.emailSendJob.count({ where }),
    prisma.manualCampaignDraft.findFirst({ where: { id: campaignId, userId } }),
  ])

  const workflowState = (manualDraftRecord?.workflowState ?? null) as PersistedWorkflowState | null
  const draftEntries = workflowState?.drafts ? Object.entries(workflowState.drafts) : []

  if (jobCount === 0 && draftEntries.length === 0) {
    return null
  }

  const [statusGroups, timeline, recentEmails] = await Promise.all([
    prisma.emailSendJob.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
    prisma.emailSendJob.aggregate({
      where,
      _min: { createdAt: true, sentAt: true },
      _max: { createdAt: true, sentAt: true },
    }),
    prisma.emailSendJob.findMany({
      where,
      orderBy: [
        { sentAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 200,
    }),
  ])

  const counts: Record<EmailSendStatus, number> = EMAIL_STATUSES.reduce(
    (acc, status) => ({ ...acc, [status]: 0 }),
    {} as Record<EmailSendStatus, number>,
  )

  statusGroups.forEach((group) => {
    counts[group.status as EmailSendStatus] = group._count
  })

  const jobMap = new Map<string, OutreachedJob>()
  recentEmails.forEach((job) => {
    jobMap.set(job.leadEmail.toLowerCase(), {
      id: job.id,
      leadEmail: job.leadEmail,
      leadFirstName: job.leadFirstName,
      leadLastName: job.leadLastName,
      leadCompany: job.leadCompany,
      leadSummary: job.leadSummary,
      subject: job.subject,
      bodyHtml: job.bodyHtml,
      bodyText: job.bodyText,
      status: job.status,
      sheetRowRef: job.sheetRowRef ?? null,
      sentAt: job.sentAt ? job.sentAt.toISOString() : null,
      createdAt: job.createdAt.toISOString(),
      manualCampaignId: job.manualCampaignId,
      manualCampaignName: job.manualCampaignName,
      manualCampaignSource: (job.manualCampaignSource as ManualOutreachSource | null) ?? null,
    })
  })

  const leads = Array.isArray(workflowState?.leads) ? workflowState.leads : []
  const leadMap = new Map<string, (typeof leads)[number]>()
  leads.forEach((lead) => {
    if (lead.email) {
      leadMap.set(lead.email.toLowerCase(), lead)
    }
  })

  const campaignName =
    workflowState?.campaignName?.trim() ||
    manualDraftRecord?.name ||
    recentEmails[0]?.manualCampaignName ||
    'Outreach campaign'

  const campaignSource =
    (workflowState?.sourceType ??
      manualDraftRecord?.sourceType ??
      recentEmails[0]?.manualCampaignSource ??
      null) as ManualOutreachSource | null

  const draftRows: OutreachedJob[] = draftEntries.reduce<OutreachedJob[]>((rows, [email, record]) => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      return rows
    }
    if (jobMap.has(normalizedEmail)) {
      return rows
    }
    const lead = leadMap.get(normalizedEmail)
    rows.push({
      id: `draft-${campaignId}-${normalizedEmail}`,
      leadEmail: email,
      leadFirstName: lead?.firstName ?? null,
      leadLastName: lead?.lastName ?? null,
      leadCompany: lead?.company ?? null,
      leadSummary: lead?.summary ?? null,
      subject: record.subject,
      bodyHtml: record.bodyHtml,
      bodyText: record.bodyText,
      status: mapDraftStatusToJobStatus(record.status as DraftStatus | undefined),
      sheetRowRef: lead?.sourceRowRef ?? null,
      sentAt: null,
      createdAt: (manualDraftRecord?.updatedAt ?? new Date()).toISOString(),
      manualCampaignId: campaignId,
      manualCampaignName: campaignName,
      manualCampaignSource: campaignSource,
    })
    return rows
  }, [])

  const emails = [...jobMap.values(), ...draftRows].sort((a, b) => {
    const aTime = Date.parse(a.sentAt ?? a.createdAt)
    const bTime = Date.parse(b.sentAt ?? b.createdAt)
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
  })

  const totalEmails = jobCount + draftRows.length

  const metrics: ManualOutreachCampaignMetrics = {
    totalEmails,
    sent: counts.SENT,
    queued: counts.QUEUED,
    pending: counts.PENDING,
    sending: counts.SENDING,
    failed: counts.FAILED,
    cancelled: counts.CANCELLED,
    drafts: draftRows.length,
  }

  return {
    campaign: {
      id: campaignId,
      name: campaignName,
      source: campaignSource,
      createdAt:
        manualDraftRecord?.createdAt?.toISOString() ??
        (timeline._min.createdAt ? timeline._min.createdAt.toISOString() : null),
      updatedAt:
        manualDraftRecord?.updatedAt?.toISOString() ??
        (timeline._max.createdAt ? timeline._max.createdAt.toISOString() : null),
      firstSentAt: timeline._min.sentAt ? timeline._min.sentAt.toISOString() : null,
      lastSentAt: timeline._max.sentAt ? timeline._max.sentAt.toISOString() : null,
      totalEmails,
    },
    metrics,
    emails,
  }
}

const getManualOutreachCampaignDetailCached = unstable_cache(fetchManualOutreachCampaignDetail, ['manual-outreach-campaign-detail'], {
  revalidate: 20,
  tags: ['manual-outreach-campaign-detail'],
})

export async function getManualOutreachCampaignDetailAction(
  campaignId: string,
  userId: string,
): Promise<ManualOutreachCampaignDetail | null> {
  return getManualOutreachCampaignDetailCached(campaignId, userId)
}

'use server'

import { cookies } from 'next/headers'
import axios from 'axios'

import { unstable_cache } from 'next/cache'

import { getApiClient } from '@/lib/http-client'
import { prisma } from '@/lib/prisma'

type LatestJobSnapshot = {
  id: string
  status: string | null
  startedAt: string | null
  finishedAt: string | null
  leadsProcessed: number
  leadsWritten: number
  totalPages: number
  attemptCount: number
  lastError: string | null
}

export type CampaignDetailMetrics = {
  totalLeads: number
  leadsWithEmail: number
  leadsWithoutEmail: number
  suppressedLeads: number
  invalidLeads: number
  readyForOutreach: number
  leadsProcessed: number
  leadsWritten: number
}

export type CampaignDetail = {
  campaign: {
    id: string
    name: string
    nicheOrJobTitle: string
    keywords: string
    location: string
    maxLeads: number
    pageSize: number
    searchMode: string
    includeDomains?: string | null
    excludeDomains?: string | null
    isActive: boolean
    createdAt: string
    updatedAt: string
    googleSheet: {
      title: string
      spreadsheetId: string
    }
  }
  latestJob: LatestJobSnapshot | null
  metrics: CampaignDetailMetrics
}

export type CreateCampaignPayload = {
  name: string
  jobTitles: string[]
  locations: string[]
  keywords: string
  maxLeads: number
  pageSize: number
  searchMode: 'balanced' | 'conserve'
  googleSheetId: string
  includeDomains?: string
  excludeDomains?: string
}

/**
 * Server action that creates a campaign for the dashboard CreateCampaignForm.
 * It forwards the authenticated cookies and calls `/api/campaigns` on the server
 * so the client component never performs the network request directly.
 */
export async function createCampaignAction(payload: CreateCampaignPayload) {
  const client = getApiClient()
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join('; ')

  try {
    const { data } = await client.post('/api/campaigns', payload, {
      headers: {
        'cache-control': 'no-store',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    })

    return data
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? ((error.response?.data as { error?: string })?.error ?? error.message)
      : error instanceof Error
        ? error.message
        : 'Failed to create campaign'
    throw new Error(message)
  }
}

const fetchCampaignDetail = async (campaignId: string, userId: string): Promise<CampaignDetail | null> => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    select: {
      id: true,
      name: true,
      nicheOrJobTitle: true,
      keywords: true,
      location: true,
      maxLeads: true,
      pageSize: true,
      searchMode: true,
      includeDomains: true,
      excludeDomains: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      googleSheet: {
        select: {
          title: true,
          spreadsheetId: true,
        },
      },
      campaignJobs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          leadsProcessed: true,
          leadsWritten: true,
          totalPages: true,
          attemptCount: true,
          lastError: true,
        },
      },
    },
  })

  if (!campaign) {
    return null
  }

  const latestJobRecord = campaign.campaignJobs[0]
  const latestJob: LatestJobSnapshot | null = latestJobRecord
    ? {
        id: latestJobRecord.id,
        status: latestJobRecord.status,
        startedAt: latestJobRecord.startedAt ? latestJobRecord.startedAt.toISOString() : null,
        finishedAt: latestJobRecord.finishedAt ? latestJobRecord.finishedAt.toISOString() : null,
        leadsProcessed: latestJobRecord.leadsProcessed,
        leadsWritten: latestJobRecord.leadsWritten,
        totalPages: latestJobRecord.totalPages,
        attemptCount: latestJobRecord.attemptCount,
        lastError: latestJobRecord.lastError,
      }
    : null

  const [totalLeads, leadsWithoutEmail, suppressedLeads, invalidLeads, readyForOutreach] = await Promise.all([
    prisma.lead.count({ where: { campaignId } }),
    prisma.lead.count({ where: { campaignId, email: '' } }),
    prisma.lead.count({ where: { campaignId, isSuppressed: true } }),
    prisma.lead.count({ where: { campaignId, isValid: false } }),
    prisma.lead.count({
      where: {
        campaignId,
        isSuppressed: false,
        isValid: true,
        NOT: { email: '' },
      },
    }),
  ])

  const metrics: CampaignDetailMetrics = {
    totalLeads,
    leadsWithoutEmail,
    leadsWithEmail: totalLeads - leadsWithoutEmail,
    suppressedLeads,
    invalidLeads,
    readyForOutreach,
    leadsProcessed: latestJob?.leadsProcessed ?? 0,
    leadsWritten: latestJob?.leadsWritten ?? 0,
  }
  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      nicheOrJobTitle: campaign.nicheOrJobTitle,
      keywords: campaign.keywords,
      location: campaign.location,
      maxLeads: campaign.maxLeads,
      pageSize: campaign.pageSize,
      searchMode: campaign.searchMode,
      includeDomains: campaign.includeDomains,
      excludeDomains: campaign.excludeDomains,
      isActive: campaign.isActive,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      googleSheet: campaign.googleSheet,
    },
    latestJob,
    metrics,
  }
}

const getCampaignDetailCached = unstable_cache(
  fetchCampaignDetail,
  ['campaign-detail'],
  {
    revalidate: 15,
    tags: ['campaign-detail'],
  },
)

export async function getCampaignDetailAction(campaignId: string, userId: string): Promise<CampaignDetail | null> {
  return getCampaignDetailCached(campaignId, userId)
}

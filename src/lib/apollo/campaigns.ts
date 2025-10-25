// src/lib/campaigns.ts
import { prisma } from '@/lib/prisma'

export interface CampaignListOptions {
  page?: number
  limit?: number
}

export interface CampaignJobSnapshot {
  status: string | null
  startedAt: string | null
  finishedAt: string | null
  leadsProcessed: number
  leadsWritten: number
  totalPages: number
  lastError: string | null
  attemptCount: number
}

export interface CampaignSummary {
  id: string
  name: string
  nicheOrJobTitle: string
  keywords: string
  location: string
  maxLeads: number
  pageSize: number
  searchMode: 'balanced' | 'conserve'
  isActive: boolean
  createdAt: string
  updatedAt: string
  googleSheet: {
    title: string
    spreadsheetId: string
  }
  latestJob: CampaignJobSnapshot | null
  totalLeads: number
}

export interface CampaignListResponse {
  campaigns: CampaignSummary[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export async function getCampaignsForUser(
  userId: string,
  { page = 1, limit = 20 }: CampaignListOptions = {}
): Promise<CampaignListResponse> {
  const offset = (page - 1) * limit

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        nicheOrJobTitle: true,
        keywords: true,
        location: true,
        maxLeads: true,
        pageSize: true,
        searchMode: true,
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
            status: true,
            startedAt: true,
            finishedAt: true,
            leadsProcessed: true,
            leadsWritten: true,
            totalPages: true,
            lastError: true,
            attemptCount: true,
          },
        },
        _count: {
          select: {
            leads: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.campaign.count({ where: { userId } }),
  ])

  const formattedCampaigns: CampaignSummary[] = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    nicheOrJobTitle: campaign.nicheOrJobTitle,
    keywords: campaign.keywords,
    location: campaign.location,
    maxLeads: campaign.maxLeads,
    pageSize: campaign.pageSize,
    searchMode: campaign.searchMode as 'balanced' | 'conserve',
    isActive: campaign.isActive,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    googleSheet: campaign.googleSheet,
    latestJob: campaign.campaignJobs[0]
      ? {
          status: campaign.campaignJobs[0].status,
          startedAt: campaign.campaignJobs[0].startedAt
            ? campaign.campaignJobs[0].startedAt.toISOString()
            : null,
          finishedAt: campaign.campaignJobs[0].finishedAt
            ? campaign.campaignJobs[0].finishedAt.toISOString()
            : null,
          leadsProcessed: campaign.campaignJobs[0].leadsProcessed,
          leadsWritten: campaign.campaignJobs[0].leadsWritten,
          totalPages: campaign.campaignJobs[0].totalPages,
          lastError: campaign.campaignJobs[0].lastError,
          attemptCount: campaign.campaignJobs[0].attemptCount,
        }
      : null,
    totalLeads: campaign._count.leads,
  }))

  return {
    campaigns: formattedCampaigns,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export type { CampaignSummary as Campaign }

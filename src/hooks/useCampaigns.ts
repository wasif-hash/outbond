// src/hooks/useCampaigns.ts
import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'react-hot-toast'

import type { CampaignListResponse, CampaignSummary } from '@/lib/campaigns'

export type Campaign = CampaignSummary

interface FetchOptions {
  skipLoading?: boolean
}

export interface CampaignStatus {
  campaign: {
    id: string
    name: string
    isActive: boolean
    createdAt: string
  }
  latestJob: {
    id: string
    status: string
    attemptCount: number
    startedAt: string | null
    finishedAt: string | null
    leadsProcessed: number
    leadsWritten: number
    totalPages: number
    lastError: string | null
    latestAttempt: Record<string, unknown> | null
  } | null
  totalLeads: number
}

export function useCampaigns(
  initialData?: CampaignListResponse,
  autoRefreshMs: number = 0
) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialData?.campaigns ?? [])
  const [pagination, setPagination] = useState(initialData?.pagination)
  const [loading, setLoading] = useState(!initialData)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const hasInitialisedRef = useRef(!!initialData)

  useEffect(() => {
    if (initialData) {
      setCampaigns(initialData.campaigns)
      setPagination(initialData.pagination)
      setLoading(false)
      hasInitialisedRef.current = true
    }
  }, [initialData])

  const fetchCampaigns = useCallback(async ({ skipLoading }: FetchOptions = {}) => {
    try {
      const shouldSkipLoading = skipLoading ?? hasInitialisedRef.current
      if (shouldSkipLoading) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const response = await fetch('/api/campaigns', {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns')
      }

      const data = await response.json()
      setCampaigns(data.campaigns)
      setPagination(data.pagination)
      hasInitialisedRef.current = true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!hasInitialisedRef.current) {
      fetchCampaigns({ skipLoading: false })
    }
  }, [fetchCampaigns])

  useEffect(() => {
    if (!autoRefreshMs) return
    const interval = setInterval(() => {
      fetchCampaigns({ skipLoading: true }).catch(() => undefined)
    }, autoRefreshMs)
    return () => clearInterval(interval)
  }, [autoRefreshMs, fetchCampaigns])

  const createCampaign = async (campaignData: {
    name: string
    nicheOrJobTitle: string // This will be split into job titles
    keywords: string
    location: string // This will be split into locations
    googleSheetId: string
    maxLeads?: number
    pageSize?: number
    searchMode?: 'balanced' | 'conserve'
  }) => {
    try {
      setActionLoading(true)
      
      // Format the data for Apollo
      const formattedData = {
        ...campaignData,
        // Split job titles and locations into arrays
        jobTitles: campaignData.nicheOrJobTitle.split(',').map(t => t.trim()),
        locations: campaignData.location.split(',').map(l => l.trim()),
        keywords: campaignData.keywords ? campaignData.keywords.split(',').map(k => k.trim()) : [],
        pageSize: campaignData.pageSize || 25,
        maxLeads: campaignData.maxLeads || 100,
        searchMode: campaignData.searchMode || 'balanced'
      }
      
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create campaign')
      }

      const data = await response.json()
      
      toast.success('Campaign created successfully! Lead fetching has started.')

      await fetchCampaigns({ skipLoading: true })
      
      return data.campaign
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create campaign'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const updateCampaign = async (campaignId: string, updates: Partial<Campaign>) => {
    try {
      setActionLoading(true)

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update campaign')
      }

      toast.success('Campaign updated successfully')
      await fetchCampaigns({ skipLoading: true })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update campaign'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const deleteCampaign = async (campaignId: string) => {
    try {
      setActionLoading(true)

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete campaign')
      }

      toast.success('Campaign deleted successfully')
      await fetchCampaigns({ skipLoading: true })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete campaign'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const retryCampaign = async (campaignId: string) => {
    try {
      setActionLoading(true)

      const response = await fetch(`/api/campaigns/${campaignId}/retry`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to retry campaign')
      }

      toast.success('Campaign retry started')
      await fetchCampaigns({ skipLoading: true })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry campaign'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  return {
    campaigns,
    pagination,
    loading: loading || actionLoading,
    refreshing,
    error,
    fetchCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    retryCampaign,
  }
}

// src/hooks/useCampaigns.ts
'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import axios from 'axios'
import { toast } from 'sonner'

import type { CampaignListResponse, CampaignSummary } from '@/lib/apollo/campaigns'
import { getApiClient, createCancelSource, CancelTokenSource } from '@/lib/http-client'

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

const extractAxiosMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const responseMessage = (error.response?.data as { error?: string })?.error
    return responseMessage || error.message || fallback
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
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
  const client = useMemo(() => getApiClient(), [])
  const cancelTokensRef = useRef<{ list: CancelTokenSource | null; action: CancelTokenSource | null }>({
    list: null,
    action: null,
  })

  useEffect(() => {
    const tokensRef = cancelTokensRef
    return () => {
      const tokens = tokensRef.current
      Object.values(tokens as Record<string, CancelTokenSource | null>)
        .filter(Boolean)
        .forEach((source) => (source as CancelTokenSource).cancel('Component unmounted'))
    }
  }, [])

  const replaceToken = useCallback((key: 'list' | 'action') => {
    const existing = cancelTokensRef.current[key]
    if (existing) {
      existing.cancel('Superseded request')
    }
    const next = createCancelSource()
    cancelTokensRef.current[key] = next
    return next
  }, [])

  const clearToken = useCallback((key: 'list' | 'action', source: CancelTokenSource | null) => {
    if (source && cancelTokensRef.current[key] === source) {
      cancelTokensRef.current[key] = null
    }
  }, [])

  useEffect(() => {
    if (initialData) {
      setCampaigns(initialData.campaigns)
      setPagination(initialData.pagination)
      setLoading(false)
      hasInitialisedRef.current = true
    }
  }, [initialData])

  const fetchCampaigns = useCallback(async ({ skipLoading }: FetchOptions = {}) => {
    let cancelSource: CancelTokenSource | null = null
    try {
      const shouldSkipLoading = skipLoading ?? hasInitialisedRef.current
      if (shouldSkipLoading) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      cancelSource = replaceToken('list')

      const { data } = await client.get<CampaignListResponse>('/api/campaigns', {
        cancelToken: cancelSource.token,
        headers: {
          Accept: 'application/json',
          'cache-control': 'no-store',
        },
      })
      setCampaigns(data.campaigns)
      setPagination(data.pagination)
      hasInitialisedRef.current = true
    } catch (err) {
      if (axios.isCancel(err)) {
        return
      }
      const errorMessage = extractAxiosMessage(err, 'Failed to fetch campaigns')
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
      setRefreshing(false)
      clearToken('list', cancelSource)
    }
  }, [client, clearToken, replaceToken])

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
    let cancelSource: CancelTokenSource | null = null
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
      
      cancelSource = replaceToken('action')
      const { data } = await client.post('/api/campaigns', formattedData, {
        cancelToken: cancelSource.token,
      })

      toast.success('Campaign created successfully! Lead fetching has started.')

      await fetchCampaigns({ skipLoading: true })

      return data.campaign
    } catch (err) {
      if (axios.isCancel(err)) {
        return undefined
      }
      const errorMessage = extractAxiosMessage(err, 'Failed to create campaign')
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setActionLoading(false)
      clearToken('action', cancelSource)
    }
  }

  const updateCampaign = async (campaignId: string, updates: Partial<Campaign>) => {
    let cancelSource: CancelTokenSource | null = null
    try {
      setActionLoading(true)

      cancelSource = replaceToken('action')
      await client.patch(`/api/campaigns/${campaignId}`, updates, {
        cancelToken: cancelSource.token,
      })

      toast.success('Campaign updated successfully')
      await fetchCampaigns({ skipLoading: true })
    } catch (err) {
      if (axios.isCancel(err)) {
        return
      }
      const errorMessage = extractAxiosMessage(err, 'Failed to update campaign')
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setActionLoading(false)
      clearToken('action', cancelSource)
    }
  }

  const deleteCampaign = async (campaignId: string) => {
    let cancelSource: CancelTokenSource | null = null
    try {
      setActionLoading(true)

      cancelSource = replaceToken('action')
      await client.delete(`/api/campaigns/${campaignId}`, {
        cancelToken: cancelSource.token,
      })

      toast.success('Campaign deleted successfully')
      await fetchCampaigns({ skipLoading: true })
    } catch (err) {
      if (axios.isCancel(err)) {
        return
      }
      const errorMessage = extractAxiosMessage(err, 'Failed to delete campaign')
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setActionLoading(false)
      clearToken('action', cancelSource)
    }
  }

  const retryCampaign = async (campaignId: string) => {
    let cancelSource: CancelTokenSource | null = null
    try {
      setActionLoading(true)

      cancelSource = replaceToken('action')
      await client.post(`/api/campaigns/${campaignId}/retry`, undefined, {
        cancelToken: cancelSource.token,
      })

      toast.success('Campaign retry started')
      await fetchCampaigns({ skipLoading: true })
    } catch (err) {
      if (axios.isCancel(err)) {
        return
      }
      const errorMessage = extractAxiosMessage(err, 'Failed to retry campaign')
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setActionLoading(false)
      clearToken('action', cancelSource)
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

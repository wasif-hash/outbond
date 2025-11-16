// src/hooks/useCampaignStatus.ts
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { CampaignStatus } from './useCampaigns'
import { getApiClient } from '@/lib/http-client'

type AttemptProgress = {
  page?: number
  totalPages?: number
  leadsProcessed?: number
  leadsWritten?: number
}

const STATUS_QUERY_KEY = (campaignId: string) => ['campaign-status', campaignId] as const

const enhanceStatus = (data: CampaignStatus): CampaignStatus => {
  if (!data.latestJob) {
    return data
  }

  if (data.latestJob.lastError?.includes('rate limit')) {
    data.latestJob.status = 'RATE_LIMITED'
  }

  if (data.latestJob.status === 'RUNNING') {
    const rawProgress = data.latestJob.latestAttempt?.progress as AttemptProgress | undefined
    const progress: AttemptProgress = rawProgress ?? {}
    data.latestJob.progress = {
      currentPage: progress.page || data.latestJob.totalPages || 1,
      totalPages:
        data.latestJob.totalPages || progress.totalPages || Math.max(progress.page || 1, 1),
      leadsProcessed: data.latestJob.leadsProcessed || progress.leadsProcessed || 0,
      leadsWritten: data.latestJob.leadsWritten || progress.leadsWritten || 0,
    }
  }

  return data
}

const resolveStatusError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { error?: string } | undefined)?.error ??
      error.message ??
      'Unable to load campaign status.'
    )
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Unable to load campaign status.'
}

export function useCampaignStatus(campaignId: string, pollingInterval: number = 5000) {
  const [pollingEnabled, setPollingEnabled] = useState(() => Boolean(campaignId))
  const [error, setError] = useState<string | null>(null)
  const previousStatusRef = useRef<string | null>(null)
  const previousErrorRef = useRef<string | null>(null)
  const previousLeadsRef = useRef<number>(0)
  const previousFetchErrorRef = useRef<string | null>(null)
  const client = useMemo(() => getApiClient(), [])

  useEffect(() => {
    setPollingEnabled(Boolean(campaignId))
  }, [campaignId])

  const statusQuery = useQuery<CampaignStatus>({
    queryKey: STATUS_QUERY_KEY(campaignId),
    queryFn: async ({ signal }) => {
      const response = await client.get<CampaignStatus>(`/api/campaigns/${campaignId}/status`, {
        signal,
      })
      return enhanceStatus(response.data)
    },
    enabled: Boolean(campaignId),
    refetchInterval: pollingEnabled ? pollingInterval : false,
    refetchOnWindowFocus: false,
  })

  const status = statusQuery.data ?? null
  const loading = statusQuery.isPending || (statusQuery.isFetching && !statusQuery.data)

  useEffect(() => {
    if (!statusQuery.error) {
      previousFetchErrorRef.current = null
      if (!statusQuery.isFetching) {
        setError(null)
      }
      return
    }

    if (axios.isCancel(statusQuery.error)) {
      return
    }

    const message = resolveStatusError(statusQuery.error)
    setError(message)
    if (previousFetchErrorRef.current !== message) {
      toast.error(message)
      previousFetchErrorRef.current = message
    }
  }, [statusQuery.error, statusQuery.isFetching])

  useEffect(() => {
    if (!status?.latestJob) {
      previousStatusRef.current = null
      previousErrorRef.current = null
      previousLeadsRef.current = 0
      return
    }

    const jobStatus = status.latestJob.status
    const campaignName = status.campaign?.name ?? 'Campaign'
    const leadsWritten =
      status.latestJob.leadsWritten ??
      status.latestJob.progress?.leadsWritten ??
      status.totalLeads ??
      0

    if (jobStatus && jobStatus !== previousStatusRef.current) {
      if (jobStatus === 'RUNNING') {
        toast.success(`"${campaignName}" is now running`, {
          description: 'Fetching fresh leads from Apollo.',
        })
      }

      if (jobStatus === 'SUCCEEDED') {
        toast.success(`"${campaignName}" finished`, {
          description: `Pulled ${leadsWritten.toLocaleString()} leads. 🎉`,
        })
      }

      if (jobStatus === 'FAILED') {
        const failureReason = status.latestJob.lastError || 'Unknown error'
        toast.error(`"${campaignName}" failed`, {
          description: failureReason,
        })
      }
    }

    const currentError = status.latestJob.lastError ?? null
    if (currentError && currentError !== previousErrorRef.current && jobStatus !== 'FAILED') {
      toast.error(`Issue in "${campaignName}"`, {
        description: currentError,
      })
    }

    if (jobStatus === 'RUNNING' && leadsWritten > previousLeadsRef.current) {
      const delta = leadsWritten - previousLeadsRef.current
      if (delta >= 50 || previousLeadsRef.current === 0) {
        toast('Leads updated', {
          description: `${campaignName}: ${leadsWritten.toLocaleString()} saved so far.`,
        })
      }
    }

    previousStatusRef.current = jobStatus ?? previousStatusRef.current
    previousErrorRef.current = currentError
    previousLeadsRef.current = leadsWritten
  }, [status])

  useEffect(() => {
    if (!pollingEnabled) {
      return
    }
    if (status?.latestJob?.status === 'SUCCEEDED' || status?.latestJob?.status === 'FAILED') {
      setPollingEnabled(false)
    }
  }, [pollingEnabled, status?.latestJob?.status])

  const stopPolling = () => {
    setPollingEnabled(false)
  }

  const startPolling = () => {
    if (campaignId) {
      setPollingEnabled(true)
    }
  }

  return {
    status,
    loading,
    error,
    refetch: statusQuery.refetch,
    startPolling,
    stopPolling,
  }
}

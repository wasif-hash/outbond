// src/hooks/useCampaignStatus.ts
'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { CampaignStatus } from './useCampaigns'
import { getApiClient, createCancelSource, CancelTokenSource } from '@/lib/http-client'

type AttemptProgress = {
  page?: number
  totalPages?: number
  leadsProcessed?: number
  leadsWritten?: number
}

export function useCampaignStatus(campaignId: string, pollingInterval: number = 5000) {
  const [status, setStatus] = useState<CampaignStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const previousStatusRef = useRef<string | null>(null)
  const previousErrorRef = useRef<string | null>(null)
  const previousLeadsRef = useRef<number>(0)
  const previousFetchErrorRef = useRef<string | null>(null)
  const client = useMemo(() => getApiClient(), [])
  const cancelRef = useRef<CancelTokenSource | null>(null)

  const fetchStatus = async () => {
    let cancelSource: CancelTokenSource | null = null
    try {
      setLoading(true)
      setError(null)

      if (cancelRef.current) {
        cancelRef.current.cancel('Superseded status request')
      }
      cancelSource = createCancelSource()
      cancelRef.current = cancelSource

      const { data } = await client.get<CampaignStatus>(`/api/campaigns/${campaignId}/status`, {
        cancelToken: cancelSource.token,
      })

      // Add additional Apollo-specific status processing
      if (data.latestJob) {
        // Handle rate limit status
        if (data.latestJob.lastError?.includes('rate limit')) {
          data.latestJob.status = 'RATE_LIMITED'
        }

        // Process progress data
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
      }

      setStatus(data)
      previousFetchErrorRef.current = null
    } catch (err) {
      if (axios.isCancel(err)) {
        return
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      if (previousFetchErrorRef.current !== errorMessage) {
        toast.error(errorMessage)
        previousFetchErrorRef.current = errorMessage
      }
    } finally {
      setLoading(false)
      if (cancelSource && cancelRef.current === cancelSource) {
        cancelRef.current = null
      }
    }
  }

  const startPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    fetchStatus() // Initial fetch
    intervalRef.current = setInterval(fetchStatus, pollingInterval)
  }

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(() => {
    if (campaignId) {
      startPolling()
    }

    return () => {
      stopPolling()
      cancelRef.current?.cancel('Component unmounted')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, pollingInterval])

  // Stop polling if job is completed or failed
  useEffect(() => {
    if (status?.latestJob?.status === 'SUCCEEDED' || status?.latestJob?.status === 'FAILED') {
      stopPolling()
    }
  }, [status?.latestJob?.status])

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
          description: 'Fetching fresh leads from Apollo.'
        })
      }

      if (jobStatus === 'SUCCEEDED') {
        toast.success(`"${campaignName}" finished`, {
          description: `Pulled ${leadsWritten.toLocaleString()} leads. 🎉`
        })
      }

      if (jobStatus === 'FAILED') {
        const failureReason = status.latestJob.lastError || 'Unknown error'
        toast.error(`"${campaignName}" failed`, {
          description: failureReason
        })
      }
    }

    const currentError = status.latestJob.lastError ?? null
    if (currentError && currentError !== previousErrorRef.current && jobStatus !== 'FAILED') {
      toast.error(`Issue in "${campaignName}"`, {
        description: currentError
      })
    }

    if (jobStatus === 'RUNNING' && leadsWritten > previousLeadsRef.current) {
      const delta = leadsWritten - previousLeadsRef.current
      if (delta >= 50 || previousLeadsRef.current === 0) {
        toast('Leads updated', {
          description: `${campaignName}: ${leadsWritten.toLocaleString()} saved so far.`
        })
      }
    }

    previousStatusRef.current = jobStatus ?? previousStatusRef.current
    previousErrorRef.current = currentError
    previousLeadsRef.current = leadsWritten
  }, [status])

  return {
    status,
    loading,
    error,
    refetch: fetchStatus,
    startPolling,
    stopPolling,
  }
}

// src/hooks/useCampaignStatus.ts
import { useState, useEffect, useRef } from 'react'
import { CampaignStatus } from './useCampaigns'

export function useCampaignStatus(campaignId: string, pollingInterval: number = 5000) {
  const [status, setStatus] = useState<CampaignStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/campaigns/${campaignId}/status`)
      if (!response.ok) {
        throw new Error('Failed to fetch campaign status')
      }

      const data = await response.json()
      setStatus(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
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
    }
  }, [campaignId, pollingInterval])

  // Stop polling if job is completed or failed
  useEffect(() => {
    if (status?.latestJob?.status === 'SUCCEEDED' || status?.latestJob?.status === 'FAILED') {
      stopPolling()
    }
  }, [status?.latestJob?.status])

  return {
    status,
    loading,
    error,
    refetch: fetchStatus,
    startPolling,
    stopPolling,
  }
}
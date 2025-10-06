'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'

import type { GmailConnectionStatus } from '@/types/gmail'
import { getApiClient, createCancelSource, CancelTokenSource } from '@/lib/http-client'

type GmailRequestKey = 'status' | 'connect' | 'disconnect'

type CachedStatusPayload = {
  status: GmailConnectionStatus
  fetchedAt: number
}

const CACHE_KEY = 'gmail-status-cache'
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000

const readCachedStatus = (): CachedStatusPayload | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedStatusPayload | null
    if (!parsed?.status || typeof parsed.fetchedAt !== 'number') {
      return null
    }
    return parsed
  } catch (error) {
    console.warn('Failed to read cached Gmail status', error)
    return null
  }
}

const writeCachedStatus = (status: GmailConnectionStatus, fetchedAt: number) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ status, fetchedAt }))
  } catch (error) {
    console.warn('Failed to cache Gmail status', error)
  }
}

const clearCachedStatus = () => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.removeItem(CACHE_KEY)
  } catch (error) {
    console.warn('Failed to clear cached Gmail status', error)
  }
}

export function useGmail() {
  const [status, setStatus] = useState<GmailConnectionStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<number | null>(null)

  const client = useMemo(() => getApiClient(), [])
  const cancelRef = useRef<Record<GmailRequestKey, CancelTokenSource | null>>({
    status: null,
    connect: null,
    disconnect: null,
  })

  useEffect(() => {
    const cancelMap = cancelRef
    return () => {
      const tokens = cancelMap.current
      Object.values(tokens as Record<string, CancelTokenSource | null>)
        .filter(Boolean)
        .forEach((source) => (source as CancelTokenSource).cancel('Component unmounted'))
    }
  }, [])

  const setCancelSource = useCallback((key: GmailRequestKey) => {
    const existing = cancelRef.current[key]
    if (existing) {
      existing.cancel('Superseded request')
    }
    const next = createCancelSource()
    cancelRef.current[key] = next
    return next
  }, [])

  const clearCancelSource = useCallback((key: GmailRequestKey, source: CancelTokenSource | null) => {
    if (source && cancelRef.current[key] === source) {
      cancelRef.current[key] = null
    }
  }, [])

  const applyStatus = useCallback((nextStatus: GmailConnectionStatus | null, fetchedAt?: number | null) => {
    setStatus(nextStatus)
    if (typeof fetchedAt === 'number') {
      setLastFetched(fetchedAt)
    } else if (fetchedAt === null) {
      setLastFetched(null)
    }
  }, [])

  const refreshStatus = useCallback(async () => {
    let cancelSource: CancelTokenSource | null = null
    setStatusLoading(true)
    try {
      cancelSource = setCancelSource('status')
      const response = await client.get<GmailConnectionStatus>('/api/gmail/status', {
        cancelToken: cancelSource.token,
      })
      const fetchedAt = Date.now()
      applyStatus(response.data, fetchedAt)
      writeCachedStatus(response.data, fetchedAt)
      setError(null)
      return response.data
    } catch (err) {
      if (axios.isCancel(err)) {
        return null
      }
      console.error('Failed to load Gmail status:', err)
      setError('Unable to load Gmail status')
      return null
    } finally {
      setStatusLoading(false)
      clearCancelSource('status', cancelSource)
    }
  }, [applyStatus, client, clearCancelSource, setCancelSource])

  const ensureStatus = useCallback(async () => {
    const cached = readCachedStatus()
    if (cached) {
      applyStatus(cached.status, cached.fetchedAt)
      const ageMs = Date.now() - cached.fetchedAt
      if (ageMs < CACHE_TTL_MS) {
        return cached.status
      }
    }
    return refreshStatus()
  }, [applyStatus, refreshStatus])

  const connect = useCallback(async () => {
    let cancelSource: CancelTokenSource | null = null
    try {
      setLoading(true)
      setError(null)
      toast.message('Redirecting to Google to connect Gmail…')

      cancelSource = setCancelSource('connect')
      const response = await client.post<{ authUrl: string }>('/api/auth/google/gmail/authorize', undefined, {
        cancelToken: cancelSource.token,
      })

      const authUrl = response.data.authUrl
      if (!authUrl) {
        throw new Error('Missing Gmail auth URL')
      }

      window.location.href = authUrl
    } catch (err) {
      if (axios.isCancel(err)) {
        return
      }
      console.error('Failed to connect Gmail:', err)
      setError('Failed to connect Gmail account')
      toast.error('Unable to start Gmail connection')
    } finally {
      clearCancelSource('connect', cancelSource)
      setLoading(false)
    }
  }, [client, clearCancelSource, setCancelSource])

  const disconnect = useCallback(async () => {
    let cancelSource: CancelTokenSource | null = null
    try {
      setLoading(true)
      setError(null)
      cancelSource = setCancelSource('disconnect')
      await client.delete('/api/gmail/disconnect', {
        cancelToken: cancelSource.token,
      })
      toast.success('Gmail account disconnected')
      applyStatus(null, null)
      clearCachedStatus()
    } catch (err) {
      if (axios.isCancel(err)) {
        return
      }
      console.error('Failed to disconnect Gmail:', err)
      setError('Failed to disconnect Gmail account')
      toast.error('Unable to disconnect Gmail account')
    } finally {
      clearCancelSource('disconnect', cancelSource)
      setLoading(false)
    }
  }, [applyStatus, client, clearCancelSource, setCancelSource])

  useEffect(() => {
    ensureStatus().catch(() => undefined)
  }, [ensureStatus])

  return {
    status,
    loading,
    statusLoading,
    error,
    lastFetched,
    setError,
    refreshStatus,
    connect,
    disconnect,
  }
}

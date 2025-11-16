'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { GmailConnectionStatus } from '@/types/gmail'
import { getApiClient, createCancelSource, CancelTokenSource } from '@/lib/http-client'

type GmailRequestKey = 'connect' | 'disconnect'

type CachedStatusPayload = {
  status: GmailConnectionStatus
  fetchedAt: number
}

const CACHE_KEY = 'gmail-status-cache'
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000
const MEMORY_CACHE_TTL_MS = CACHE_TTL_MS
const FETCH_ERROR_MESSAGE = 'Unable to load Gmail status'

let cachedStatusInMemory: GmailConnectionStatus | null = null
let cachedFetchedAtInMemory: number | null = null

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

const resolveInitialCache = () => {
  if (cachedStatusInMemory && cachedFetchedAtInMemory) {
    const memoryAge = Date.now() - cachedFetchedAtInMemory
    if (memoryAge < MEMORY_CACHE_TTL_MS) {
      return {
        status: cachedStatusInMemory,
        fetchedAt: cachedFetchedAtInMemory,
      }
    }
  }

  const cached = readCachedStatus()
  if (cached) {
    cachedStatusInMemory = cached.status
    cachedFetchedAtInMemory = cached.fetchedAt
    return cached
  }

  return { status: null, fetchedAt: null }
}

const resolveErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { error?: string; message?: string } | undefined)?.error ??
      (error.response?.data as { error?: string; message?: string } | undefined)?.message ??
      error.message ??
      fallback
    )
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export function useGmail() {
  const [{ status: initialStatus, fetchedAt: initialFetchedAt }] = useState(resolveInitialCache)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedState, setLastFetchedState] = useState<number | null>(() => initialFetchedAt ?? null)

  const client = useMemo(() => getApiClient(), [])
  const queryClient = useQueryClient()
  const cancelRef = useRef<Record<GmailRequestKey, CancelTokenSource | null>>({
    connect: null,
    disconnect: null,
  })

  const cancelAllRequests = useCallback(() => {
    const tokens = cancelRef.current
    Object.values(tokens).forEach((source) => source?.cancel('Component unmounted'))
  }, [])

  useEffect(() => cancelAllRequests, [cancelAllRequests])

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

  const statusQuery = useQuery<GmailConnectionStatus | null>({
    queryKey: ['gmail', 'status'],
    queryFn: async ({ signal }) => {
      const response = await client.get<GmailConnectionStatus>('/api/gmail/status', { signal })
      return response.data
    },
    initialData: initialStatus,
    initialDataUpdatedAt: initialFetchedAt ?? undefined,
    staleTime: CACHE_TTL_MS,
    gcTime: CACHE_TTL_MS,
    refetchOnWindowFocus: false,
  })

  const { data, dataUpdatedAt, status: queryStatus, error: queryError, isFetching, refetch } = statusQuery
  const status = data ?? null
  const statusLoading = isFetching

  useEffect(() => {
    if (queryStatus !== 'success') {
      return
    }

    if (status) {
      const fetchedAt = dataUpdatedAt || Date.now()
      cachedStatusInMemory = status
      cachedFetchedAtInMemory = fetchedAt
      setLastFetchedState(fetchedAt)
      if (status.isConnected) {
        writeCachedStatus(status, fetchedAt)
      } else {
        clearCachedStatus()
      }
    } else {
      cachedStatusInMemory = null
      cachedFetchedAtInMemory = null
      setLastFetchedState(null)
      clearCachedStatus()
    }
  }, [dataUpdatedAt, queryStatus, status])

  useEffect(() => {
    if (queryStatus === 'error') {
      if (axios.isCancel(queryError)) {
        return
      }
      setError(resolveErrorMessage(queryError, FETCH_ERROR_MESSAGE))
    } else if (queryStatus === 'success' && error === FETCH_ERROR_MESSAGE) {
      setError(null)
    }
  }, [error, queryError, queryStatus])

  const refreshStatus = useCallback(async () => {
    if (error === FETCH_ERROR_MESSAGE) {
      setError(null)
    }
    try {
      const result = await refetch({ throwOnError: false })
      return result.data ?? null
    } catch (err) {
      if (!axios.isCancel(err)) {
        setError(resolveErrorMessage(err, FETCH_ERROR_MESSAGE))
      }
      return null
    }
  }, [error, refetch])

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
      cachedStatusInMemory = null
      cachedFetchedAtInMemory = null
      clearCachedStatus()
      setLastFetchedState(null)
      queryClient.setQueryData(['gmail', 'status'], null)
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
  }, [client, clearCancelSource, queryClient, setCancelSource])

  return {
    status,
    loading,
    statusLoading,
    error,
    lastFetched: lastFetchedState,
    setError,
    refreshStatus,
    connect,
    disconnect,
  }
}

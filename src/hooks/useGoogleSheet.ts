'use client'

import { useCallback, useMemo, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import {
  QueryFunctionContext,
  useIsFetching,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  GoogleConnectionStatus,
  GoogleSpreadsheet,
  GoogleSheetsListResponse,
  SpreadsheetData,
} from '@/types/google-sheet'
import { getApiClient } from '@/lib/http-client'

const STATUS_QUERY_KEY = ['googleSheets', 'status'] as const
const SPREADSHEETS_QUERY_KEY = ['googleSheets', 'spreadsheets'] as const
const sheetDataQueryKey = (spreadsheetId: string, range?: string) =>
  ['googleSheets', 'sheetData', spreadsheetId, range?.trim() || '__FULL_RANGE__'] as const

const STATUS_STALE_TIME = 1000 * 60 * 5
const STATUS_GC_TIME = 1000 * 60 * 30
const SPREADSHEETS_GC_TIME = 1000 * 60 * 60
const SHEET_DATA_STALE_TIME = 1000 * 60 * 5
const SHEET_DATA_GC_TIME = 1000 * 60 * 30

type StatusQueryKey = typeof STATUS_QUERY_KEY
type SpreadsheetsQueryKey = typeof SPREADSHEETS_QUERY_KEY
type SheetDataQueryKey = ReturnType<typeof sheetDataQueryKey>

const resolveAxiosError = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const responseError =
      (error.response?.data as { error?: string; message?: string } | undefined)?.error ??
      (error.response?.data as { error?: string; message?: string } | undefined)?.message
    if (responseError) {
      return responseError
    }
    if (error.message) {
      return error.message
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export const useGoogleSheets = () => {
  const client = useMemo(() => getApiClient(), [])
  const queryClient = useQueryClient()

  const [selectedSheet, setSelectedSheet] = useState<SpreadsheetData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manualLoadingCount, setManualLoadingCount] = useState(0)

  const beginManualLoading = useCallback(() => {
    setManualLoadingCount((count) => count + 1)
  }, [])

  const endManualLoading = useCallback(() => {
    setManualLoadingCount((count) => (count > 0 ? count - 1 : 0))
  }, [])

  const statusQueryFn = useCallback(
    async ({ signal }: QueryFunctionContext<StatusQueryKey>) => {
      const response = await client.get<GoogleConnectionStatus>('/api/google-sheets/status', { signal })
      return response.data
    },
    [client],
  )

  const spreadsheetsQueryFn = useCallback(
    async ({ signal }: QueryFunctionContext<SpreadsheetsQueryKey>) => {
      const response = await client.get<{ spreadsheets: GoogleSpreadsheet[] }>(
        '/api/google-sheets/stored',
        { signal },
      )
      return response.data.spreadsheets ?? []
    },
    [client],
  )

  const sheetDataQueryFn = useCallback(
    async ({ queryKey, signal }: QueryFunctionContext<SheetDataQueryKey>) => {
      const [, , spreadsheetId, rangeKey] = queryKey
      const range = rangeKey === '__FULL_RANGE__' ? undefined : rangeKey
      const config = range ? { params: { range }, signal } : { signal }
      const response = await client.get<SpreadsheetData>(`/api/google-sheets/${spreadsheetId}`, config)
      return response.data
    },
    [client],
  )

  const statusQuery = useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: statusQueryFn,
    staleTime: STATUS_STALE_TIME,
    gcTime: STATUS_GC_TIME,
    refetchOnWindowFocus: false,
  })

  const status = statusQuery.data ?? null

  const spreadsheetsQuery = useQuery({
    queryKey: SPREADSHEETS_QUERY_KEY,
    queryFn: spreadsheetsQueryFn,
    enabled: Boolean(status?.isConnected && !status?.isExpired),
    staleTime: Infinity,
    gcTime: SPREADSHEETS_GC_TIME,
    refetchOnWindowFocus: false,
  })
  const spreadsheets = spreadsheetsQuery.data ?? []

  const sheetDataFetching = useIsFetching({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === 'googleSheets' &&
      query.queryKey[1] === 'sheetData',
  })

  const loading =
    manualLoadingCount > 0 || statusQuery.isFetching || spreadsheetsQuery.isFetching || sheetDataFetching > 0

  const checkConnectionStatus = useCallback(async () => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: STATUS_QUERY_KEY,
        queryFn: statusQueryFn,
        staleTime: STATUS_STALE_TIME,
      })
      return data
    } catch (err) {
      if (!axios.isCancel(err)) {
        console.error('Failed to check connection status:', err)
        toast.error('Unable to verify Google Sheets connection')
      }
      return undefined
    }
  }, [queryClient, statusQueryFn])

  const connectGoogleAccount = useCallback(async () => {
    try {
      beginManualLoading()
      setError(null)
      toast.message('Redirecting to Google for authorization…')

      const response = await client.get<{ authUrl: string }>('/api/auth/google')
      window.location.href = response.data.authUrl
    } catch (err) {
      if (!axios.isCancel(err)) {
        const message = 'Failed to connect Google account'
        setError(message)
        console.error('Connect error:', err)
        toast.error('Failed to start Google authorization')
      }
    } finally {
      endManualLoading()
    }
  }, [beginManualLoading, client, endManualLoading])

  const disconnectGoogleAccount = useCallback(async () => {
    try {
      beginManualLoading()
      setError(null)

      await client.delete('/api/google-sheets/disconnect')

      toast.success('Google Sheets disconnected')
      setSelectedSheet(null)
      queryClient.setQueryData(STATUS_QUERY_KEY, null)
      queryClient.removeQueries({ queryKey: SPREADSHEETS_QUERY_KEY, exact: true })
      queryClient.removeQueries({
        predicate: ({ queryKey }) =>
          Array.isArray(queryKey) && queryKey[0] === 'googleSheets' && queryKey[1] === 'sheetData',
      })
    } catch (err) {
      if (!axios.isCancel(err)) {
        const message = 'Failed to disconnect Google account'
        setError(message)
        console.error('Disconnect error:', err)
        toast.error(message)
      }
    } finally {
      endManualLoading()
    }
  }, [beginManualLoading, client, endManualLoading, queryClient])

  const fetchSpreadsheets = useCallback(
    async (options?: { force?: boolean }) => {
      const forceRefresh = options?.force ?? false
      const cachedSheets = queryClient.getQueryData<GoogleSpreadsheet[]>(SPREADSHEETS_QUERY_KEY)
      const hasCachedSheets = Array.isArray(cachedSheets)
      const hasNonEmptyCache = Boolean(cachedSheets && cachedSheets.length > 0)
      const hasFetchedBefore = Boolean(
        queryClient.getQueryState<GoogleSpreadsheet[]>(SPREADSHEETS_QUERY_KEY)?.dataUpdatedAt,
      )
      const shouldRefreshRemote = forceRefresh || !hasFetchedBefore || !hasNonEmptyCache
      const needsQueryFetch = !hasCachedSheets
      let remoteRequestFailed = false
      let remoteSheets: GoogleSpreadsheet[] | null = null

      if (!shouldRefreshRemote && !needsQueryFetch && cachedSheets) {
        return cachedSheets
      }

      beginManualLoading()
      try {
        if (shouldRefreshRemote) {
          try {
            const response = await client.get<GoogleSheetsListResponse>('/api/google-sheets')
            remoteSheets = Array.isArray(response.data?.spreadsheets) ? response.data.spreadsheets : null
            if (remoteSheets && remoteSheets.length) {
              queryClient.setQueryData(SPREADSHEETS_QUERY_KEY, remoteSheets)
            }
            await queryClient.invalidateQueries({ queryKey: SPREADSHEETS_QUERY_KEY, exact: true })
          } catch (err) {
            remoteRequestFailed = true
            if (!axios.isCancel(err)) {
              const message = resolveAxiosError(err, 'Failed to refresh Google Sheets library')
              setError(message)
              console.error('Fetch spreadsheets refresh error:', err)
              toast.error(message)
            }
          }
        }

        const sheets = await queryClient.fetchQuery({
          queryKey: SPREADSHEETS_QUERY_KEY,
          queryFn: spreadsheetsQueryFn,
          staleTime: Infinity,
          gcTime: SPREADSHEETS_GC_TIME,
        })

        const result = remoteSheets && remoteSheets.length ? remoteSheets : sheets

        if (!remoteRequestFailed) {
          if (forceRefresh) {
            toast.success('Google Sheets library refreshed')
          } else if (shouldRefreshRemote && result.length === 0) {
            toast.message('No spreadsheets saved yet', {
              description: 'Connect a sheet to start syncing leads.',
            })
          }
        }

        return result
      } catch (err) {
        if (!axios.isCancel(err)) {
          const message = resolveAxiosError(err, 'Failed to fetch spreadsheets')
          setError(message)
          console.error('Fetch spreadsheets error:', err)
          toast.error(message)
        }
        return []
      } finally {
        endManualLoading()
      }
    },
    [beginManualLoading, client, endManualLoading, queryClient, spreadsheetsQueryFn],
  )
  const fetchSheetData = useCallback(
    async (spreadsheetId: string, range?: string) => {
      const queryKey = sheetDataQueryKey(spreadsheetId, range)
      const cached = queryClient.getQueryData<SpreadsheetData>(queryKey)
      if (cached) {
        setSelectedSheet(cached)
      }
      const state = queryClient.getQueryState<SpreadsheetData>(queryKey)
      const dataUpdatedAt = state?.dataUpdatedAt ?? 0
      const isInvalidated = Boolean(state && (state as { isInvalidated?: boolean }).isInvalidated)
      const isFresh =
        Boolean(cached) &&
        dataUpdatedAt > 0 &&
        Date.now() - dataUpdatedAt < SHEET_DATA_STALE_TIME &&
        !isInvalidated

      if (isFresh && cached) {
        return cached
      }

      beginManualLoading()
      try {
        const data = await queryClient.fetchQuery({
          queryKey,
          queryFn: sheetDataQueryFn,
          staleTime: SHEET_DATA_STALE_TIME,
          gcTime: SHEET_DATA_GC_TIME,
        })
        setSelectedSheet(data)
        const rowCount = Array.isArray(data.data) ? data.data.length : 0
        toast.success(`Loaded ${rowCount} rows from Google Sheets`)
        return data
      } catch (err) {
        if (!axios.isCancel(err)) {
          const message = resolveAxiosError(err, 'Failed to fetch sheet data')
          setError(message)
          console.error('Fetch sheet data error:', err)
          toast.error(message)
        }
        return undefined
      } finally {
        endManualLoading()
      }
    },
    [beginManualLoading, endManualLoading, queryClient, sheetDataQueryFn],
  )

  return {
    status,
    spreadsheets,
    selectedSheet,
    loading,
    error,
    setError,
    checkConnectionStatus,
    connectGoogleAccount,
    disconnectGoogleAccount,
    fetchSpreadsheets,
    fetchSheetData,
    hasFetchedSpreadsheets: Boolean(spreadsheetsQuery.dataUpdatedAt),
  }
}

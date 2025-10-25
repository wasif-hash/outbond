'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { GoogleSpreadsheet, SpreadsheetData, GoogleConnectionStatus } from '@/types/google-sheet'
import { getApiClient, createCancelSource, CancelTokenSource } from '@/lib/http-client'

type RequestKey = 'status' | 'connect' | 'disconnect' | 'spreadsheets' | 'sheetData'

let cachedStatus: GoogleConnectionStatus | null = null
let cachedSpreadsheets: GoogleSpreadsheet[] = []
let cachedSelectedSheet: SpreadsheetData | null = null
let cachedHasFetchedSpreadsheets = false

const resolveStateAction = <T,>(action: SetStateAction<T>, prev: T): T =>
  typeof action === 'function' ? (action as (previous: T) => T)(prev) : action

export const useGoogleSheets = () => {
  const [statusState, setStatusState] = useState<GoogleConnectionStatus | null>(() => cachedStatus)
  const [spreadsheetsState, setSpreadsheetsState] = useState<GoogleSpreadsheet[]>(() => cachedSpreadsheets)
  const [selectedSheetState, setSelectedSheetState] = useState<SpreadsheetData | null>(() => cachedSelectedSheet)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasFetchedSpreadsheetsState, setHasFetchedSpreadsheetsState] = useState<boolean>(() => cachedHasFetchedSpreadsheets)

  const setStatus = (value: SetStateAction<GoogleConnectionStatus | null>) => {
    setStatusState((previous) => {
      const next = resolveStateAction(value, previous)
      cachedStatus = next
      return next
    })
  }

  const setSpreadsheets = (value: SetStateAction<GoogleSpreadsheet[]>) => {
    setSpreadsheetsState((previous) => {
      const next = resolveStateAction(value, previous)
      cachedSpreadsheets = next
      return next
    })
  }

  const setSelectedSheet = (value: SetStateAction<SpreadsheetData | null>) => {
    setSelectedSheetState((previous) => {
      const next = resolveStateAction(value, previous)
      cachedSelectedSheet = next
      return next
    })
  }

  const setHasFetchedSpreadsheets = (value: SetStateAction<boolean>) => {
    setHasFetchedSpreadsheetsState((previous) => {
      const next = resolveStateAction(value, previous)
      cachedHasFetchedSpreadsheets = next
      return next
    })
  }

  const status = statusState
  const spreadsheets = spreadsheetsState
  const selectedSheet = selectedSheetState
  const hasFetchedSpreadsheets = hasFetchedSpreadsheetsState

  const client = useMemo(() => getApiClient(), [])
  const cancelMapRef = useRef<Record<RequestKey, CancelTokenSource | null>>({
    status: null,
    connect: null,
    disconnect: null,
    spreadsheets: null,
    sheetData: null,
  })

  useEffect(() => () => {
    ;(Object.values(cancelMapRef.current) as CancelTokenSource[])
      .filter(Boolean)
      .forEach((source) => source.cancel('Component unmounted'))
  }, [])

  const replaceCancelToken = (key: RequestKey) => {
    const existing = cancelMapRef.current[key]
    if (existing) {
      existing.cancel('Replaced by a new request')
    }
    const next = createCancelSource()
    cancelMapRef.current[key] = next
    return next
  }

  const clearCancelToken = (key: RequestKey, source: CancelTokenSource | null) => {
    if (source && cancelMapRef.current[key] === source) {
      cancelMapRef.current[key] = null
    }
  }

  const checkConnectionStatus = async () => {
    let cancelSource: CancelTokenSource | null = null
    try {
      cancelSource = replaceCancelToken('status')
      const response = await client.get<GoogleConnectionStatus>('/api/google-sheets/status', {
        cancelToken: cancelSource.token,
      })
      setStatus(response.data)
    } catch (err) {
      if (axios.isCancel(err)) {
        return
      }
      console.error('Failed to check connection status:', err)
      toast.error('Unable to verify Google Sheets connection')
    } finally {
      clearCancelToken('status', cancelSource)
    }
  }

  const connectGoogleAccount = async () => {
    let cancelSource: CancelTokenSource | null = null
    try {
      setLoading(true)
      setError(null)
      toast.message('Redirecting to Google for authorization…')

      cancelSource = replaceCancelToken('connect')
      const response = await client.get<{ authUrl: string }>('/api/auth/google', {
        cancelToken: cancelSource.token,
      })
      window.location.href = response.data.authUrl
    } catch (err) {
      if (axios.isCancel(err)) {
        return
      }
      setError('Failed to connect Google account')
      console.error('Connect error:', err)
      toast.error('Failed to start Google authorization')
    } finally {
      clearCancelToken('connect', cancelSource)
      setLoading(false)
    }
  }

  const disconnectGoogleAccount = async () => {
    let cancelSource: CancelTokenSource | null = null
    try {
      setLoading(true)
      setError(null)

      cancelSource = replaceCancelToken('disconnect')
      await client.delete('/api/google-sheets/disconnect', {
        cancelToken: cancelSource.token,
      })

      toast.success('Google Sheets disconnected')
      setStatus(null)
      setSpreadsheets([])
      setSelectedSheet(null)
      setHasFetchedSpreadsheets(false)
      cachedSpreadsheets = []
      cachedSelectedSheet = null
      checkConnectionStatus()
    } catch (err) {
      if (axios.isCancel(err)) {
        return
      }
      setError('Failed to disconnect Google account')
      console.error('Disconnect error:', err)
      toast.error('Failed to disconnect Google account')
    } finally {
      clearCancelToken('disconnect', cancelSource)
      setLoading(false)
    }
  }

  const fetchSpreadsheets = async () => {
    let cancelSource: CancelTokenSource | null = null
    try {
      setLoading(true)
      setError(null)

      cancelSource = replaceCancelToken('spreadsheets')
      await client.get('/api/google-sheets', {
        cancelToken: cancelSource.token,
      })

      const stored = await client.get<{ spreadsheets: GoogleSpreadsheet[] }>('/api/google-sheets/stored', {
        cancelToken: cancelSource.token,
      })

      setSpreadsheets(stored.data.spreadsheets)
      setHasFetchedSpreadsheets(true)
      toast.success('Google Sheets library refreshed')
      if (stored.data.spreadsheets.length === 0) {
        toast.message('No spreadsheets saved yet', {
          description: 'Connect a sheet to start syncing leads.',
        })
      }
    } catch (err) {
      if (axios.isCancel(err)) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to fetch spreadsheets'
      setError(message)
      console.error('Fetch spreadsheets error:', err)
      toast.error(message)
    } finally {
      clearCancelToken('spreadsheets', cancelSource)
      setLoading(false)
    }
  }

  const fetchSheetData = async (spreadsheetId: string, range?: string) => {
    let cancelSource: CancelTokenSource | null = null
    try {
      setLoading(true)
      setError(null)

      cancelSource = replaceCancelToken('sheetData')
      const params = range ? { params: { range } } : undefined
      const response = await client.get<SpreadsheetData>(`/api/google-sheets/${spreadsheetId}`, {
        ...(params || {}),
        cancelToken: cancelSource.token,
      })

      setSelectedSheet(response.data)
      const rowCount = Array.isArray(response.data.data) ? response.data.data.length : 0
      toast.success(`Loaded ${rowCount} rows from Google Sheets`)
      return response.data
    } catch (err) {
      if (axios.isCancel(err)) {
        return undefined
      }
      const message = err instanceof Error ? err.message : 'Failed to fetch sheet data'
      setError(message)
      console.error('Fetch sheet data error:', err)
      toast.error(message)
      return undefined
    } finally {
      clearCancelToken('sheetData', cancelSource)
      setLoading(false)
    }
  }

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
    hasFetchedSpreadsheets,
  }
}

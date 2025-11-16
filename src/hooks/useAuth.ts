"use client"

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient } from '@/lib/http-client'

interface User {
  id: string
  email: string
  role: string
}

interface AuthState {
  user: User | null
  loading: boolean
  isAdmin: boolean
}

const AUTH_STORAGE_KEY = 'auth-token'

const readStoredUser = (): User | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const stored = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!stored) {
    return null
  }

  try {
    return JSON.parse(stored) as User
  } catch (error) {
    console.error('Failed to parse stored auth user:', error)
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

/**
 * Client-side authentication hook
 * Provides user state and authentication methods
 */
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const storedUser = readStoredUser()
    if (storedUser) {
      return {
        user: storedUser,
        loading: true,
        isAdmin: storedUser.role === 'admin',
      }
    }

    return {
      user: null,
      loading: true,
      isAdmin: false,
    }
  })

  const client = useMemo(() => getApiClient(), [])
  const queryClient = useQueryClient()

  const sessionQuery = useQuery<User | null>({
    queryKey: ['auth', 'session'],
    queryFn: async ({ signal }) => {
      try {
        const response = await client.get<{ user: User }>('/api/auth/session', {
          signal,
          headers: {
            'cache-control': 'no-store',
          },
        })
        return response.data.user
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          return null
        }
        throw error
      }
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (sessionQuery.status === 'success') {
      const user = sessionQuery.data

      if (typeof window !== 'undefined') {
        if (user) {
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
        } else {
          window.localStorage.removeItem(AUTH_STORAGE_KEY)
        }
      }

      setAuthState({
        user,
        loading: false,
        isAdmin: Boolean(user?.role === 'admin'),
      })
      return
    }

    if (sessionQuery.status === 'error') {
      if (!axios.isCancel(sessionQuery.error)) {
        console.error('Failed to validate session:', sessionQuery.error)
      }
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      }
      setAuthState({
        user: null,
        loading: false,
        isAdmin: false,
      })
    }
  }, [sessionQuery.data, sessionQuery.error, sessionQuery.status])

  const logout = async () => {
    try {
      await client.post('/api/auth/logout')
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      }
      setAuthState({
        user: null,
        loading: false,
        isAdmin: false
      })
      queryClient.setQueryData(['auth', 'session'], null)
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const setUser = (user: User) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
    }
    setAuthState({
      user,
      loading: false,
      isAdmin: user.role === 'admin'
    })
    queryClient.setQueryData(['auth', 'session'], user)
  }

  return {
    ...authState,
    logout,
    setUser
  }
}

"use client"

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { getApiClient, createCancelSource } from '@/lib/http-client'

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

/**
 * Client-side authentication hook
 * Provides user state and authentication methods
 */
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    isAdmin: false
  })

  const client = useMemo(() => getApiClient(), [])

  useEffect(() => {
    let cancelled = false
    const cancelSource = createCancelSource()

    const userInfo = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
    if (userInfo) {
      try {
        const parsedUser: User = JSON.parse(userInfo)
        if (!cancelled) {
          setAuthState({
            user: parsedUser,
            loading: true,
            isAdmin: parsedUser.role === 'admin'
          })
        }
      } catch (error) {
        console.error('Failed to parse user info:', error)
        localStorage.removeItem('auth-token')
      }
    }

    const syncSession = async () => {
      try {
        const response = await client.get<{ user: User }>('/api/auth/session', {
          cancelToken: cancelSource.token,
          headers: {
            'cache-control': 'no-store'
          }
        })

        if (!cancelled) {
          const data = response.data
          localStorage.setItem('auth-token', JSON.stringify(data.user))
          setAuthState({
            user: data.user,
            loading: false,
            isAdmin: data.user.role === 'admin'
          })
        }
      } catch (error) {
        if (axios.isCancel(error)) {
          return
        }
        const isUnauthorized = axios.isAxiosError(error) && error.response?.status === 401
        if (!isUnauthorized) {
          console.error('Failed to validate session:', error)
        }
        if (!cancelled) {
          localStorage.removeItem('auth-token')
          setAuthState({
            user: null,
            loading: false,
            isAdmin: false
          })
        }
      }
    }

    syncSession()

    return () => {
      cancelled = true
      cancelSource.cancel('Component unmounted')
    }
  }, [client])

  const logout = async () => {
    try {
      await client.post('/api/auth/logout')
      localStorage.removeItem('auth-token')
      setAuthState({
        user: null,
        loading: false,
        isAdmin: false
      })
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const setUser = (user: User) => {
    localStorage.setItem('auth-token', JSON.stringify(user))
    setAuthState({
      user,
      loading: false,
      isAdmin: user.role === 'admin'
    })
  }

  return {
    ...authState,
    logout,
    setUser
  }
}

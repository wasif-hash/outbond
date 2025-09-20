"use client"

import { useState, useEffect } from 'react'

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

  useEffect(() => {
    // Get user info from localStorage (set during login)
    const userInfo = localStorage.getItem('auth-token')
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo)
        setAuthState({
          user,
          loading: false,
          isAdmin: user.role === 'admin'
        })
      } catch (error) {
        console.error('Failed to parse user info:', error)
        setAuthState({
          user: null,
          loading: false,
          isAdmin: false
        })
      }
    } else {
      setAuthState({
        user: null,
        loading: false,
        isAdmin: false
      })
    }
  }, [])

  const logout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' })
      localStorage.removeItem('auth-token')
      setAuthState({
        user: null,
        loading: false,
        isAdmin: false
      })
      window.location.href = '/'
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

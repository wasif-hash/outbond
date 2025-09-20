"use client"

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  adminOnly?: boolean
}

/**
 * Client-side route protection component
 * Use this to wrap components that require authentication
 */
export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/')
        return
      }

      if (adminOnly && !isAdmin) {
        router.push('/dashboard')
        return
      }
    }
  }, [user, loading, isAdmin, adminOnly, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cwt-plum"></div>
      </div>
    )
  }

  if (!user || (adminOnly && !isAdmin)) {
    return null
  }

  return <>{children}</>
}
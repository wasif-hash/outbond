// src/hooks/useCampaigns.ts
import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

export interface Campaign {
  id: string
  name: string
  nicheOrJobTitle: string
  keywords: string
  location: string
  maxLeads: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  googleSheet: {
    title: string
    spreadsheetId: string
  }
  latestJob: {
    status: string
    startedAt: string | null
    finishedAt: string | null
    leadsProcessed: number
    lastError: string | null
    attemptCount: number
  } | null
  totalLeads: number
}

export interface CampaignStatus {
  campaign: {
    id: string
    name: string
    isActive: boolean
    createdAt: string
  }
  latestJob: {
    id: string
    status: string
    attemptCount: number
    startedAt: string | null
    finishedAt: string | null
    leadsProcessed: number
    leadsWritten: number
    totalPages: number
    lastError: string | null
    latestAttempt: any
  } | null
  totalLeads: number
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/campaigns')
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns')
      }

      const data = await response.json()
      setCampaigns(data.campaigns)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const createCampaign = async (campaignData: {
    name: string
    nicheOrJobTitle: string
    keywords: string
    location: string
    googleSheetId: string
    maxLeads?: number
  }) => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(campaignData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create campaign')
      }

      const data = await response.json()
      
      toast.success('Campaign created successfully! Lead fetching has started.')
      
      // Refresh campaigns list
      await fetchCampaigns()
      
      return data.campaign
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create campaign'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const updateCampaign = async (campaignId: string, updates: Partial<Campaign>) => {
    try {
      setLoading(true)

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update campaign')
      }

      toast.success('Campaign updated successfully')
      await fetchCampaigns()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update campaign'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const deleteCampaign = async (campaignId: string) => {
    try {
      setLoading(true)

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete campaign')
      }

      toast.success('Campaign deleted successfully')
      await fetchCampaigns()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete campaign'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const retryCampaign = async (campaignId: string) => {
    try {
      setLoading(true)

      const response = await fetch(`/api/campaigns/${campaignId}/retry`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to retry campaign')
      }

      toast.success('Campaign retry started')
      await fetchCampaigns()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry campaign'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    campaigns,
    loading,
    error,
    fetchCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    retryCampaign,
  }
}


// src/app/dashboard/campaigns/page.tsx
"use client"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Plus, RefreshCw } from "lucide-react"
import { toast } from 'react-hot-toast'

import { useCampaigns } from '@/hooks/useCampaigns'
import { useCampaignStatus } from '@/hooks/useCampaignStatus'

import { formatRelativeTime } from '@/lib/utils'
import { CampaignStatusBadge } from "@/components/campaigns/CampaignStatusBadge"
import { CampaignActions } from "@/components/campaigns/CampaignActions"
import { CampaignMetrics, CampaignProgressIndicator } from "@/components/campaigns/CampaignProgressIndicator"
import { CreateCampaignForm } from "@/components/campaigns/createCampaignForm"

export default function Campaigns() {
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const {
    campaigns,
    loading,
    error,
    fetchCampaigns,
    updateCampaign,
    deleteCampaign,
    retryCampaign,
  } = useCampaigns()

  const {
    status: selectedCampaignStatus,
    loading: statusLoading,
    startPolling,
    stopPolling,
  } = useCampaignStatus(selectedCampaign || '', 5000)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchCampaigns()
    setRefreshing(false)
    toast.success('Campaigns refreshed')
  }

  const handleToggleActive = async (campaignId: string, isActive: boolean) => {
    try {
      await updateCampaign(campaignId, { isActive })
    } catch (error) {
      // Error is handled in the hook
    }
  }

  const handleRetry = async (campaignId: string) => {
    try {
      await retryCampaign(campaignId)
      // Start polling if this is the selected campaign
      if (campaignId === selectedCampaign) {
        startPolling()
      }
    } catch (error) {
      // Error is handled in the hook
    }
  }

  const handleDelete = async (campaignId: string) => {
    if (window.confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      try {
        await deleteCampaign(campaignId)
        if (campaignId === selectedCampaign) {
          setSelectedCampaign(null)
          stopPolling()
        }
      } catch (error) {
        // Error is handled in the hook
      }
    }
  }

  const handleCampaignCreated = async () => {
    await fetchCampaigns()
  }

  const handleSelectCampaign = (campaignId: string) => {
    setSelectedCampaign(campaignId)
  }

  const selectedCampaignData = campaigns.find(c => c.id === selectedCampaign)

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">Error loading campaigns: {error}</div>
          <Button 
            onClick={handleRefresh}
            variant="outline" 
            size="sm" 
            className="mt-2"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-mono font-bold text-foreground">Campaigns</h1>
            <p className="text-muted-foreground mt-1">Manage and monitor your lead generation campaigns</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        </div>
      </div>

      {loading && campaigns.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading campaigns...</div>
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first campaign to start generating leads
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card 
              key={campaign.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleSelectCampaign(campaign.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-mono font-bold">{campaign.name}</h3>
                      <CampaignStatusBadge
                        status={campaign.latestJob?.status || 'PENDING'} 
                      />
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div><strong>Target:</strong> {campaign.nicheOrJobTitle}</div>
                      <div><strong>Location:</strong> {campaign.location}</div>
                      {campaign.keywords && (
                        <div><strong>Keywords:</strong> {campaign.keywords}</div>
                      )}
                      <div><strong>Google Sheet:</strong> {campaign.googleSheet.title}</div>
                    </div>
                  </div>
                  
                  <CampaignActions
                    campaign={campaign}
                    latestJobStatus={campaign.latestJob?.status}
                    onToggleActive={handleToggleActive}
                    onRetry={handleRetry}
                    onDelete={handleDelete}
                    disabled={loading}
                  />
                </div>

                <CampaignMetrics
                  totalLeads={campaign.totalLeads}
                  leadsProcessed={campaign.latestJob?.leadsProcessed}
                  leadsWritten={campaign.latestJob?.leadsProcessed} // Using same value for now
                  status={campaign.latestJob?.status}
                />

                {campaign.latestJob && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                    <div>
                      {campaign.latestJob.startedAt && (
                        <span>Started: {formatRelativeTime(new Date(campaign.latestJob.startedAt))}</span>
                      )}
                      {campaign.latestJob.finishedAt && (
                        <span className="ml-4">
                          Finished: {formatRelativeTime(new Date(campaign.latestJob.finishedAt))}
                        </span>
                      )}
                    </div>
                    
                    {campaign.latestJob.lastError && (
                      <div className="text-red-600 font-medium">
                        Error: {campaign.latestJob.lastError}
                      </div>
                    )}
                  </div>
                )}

                {campaign.latestJob?.status === 'RUNNING' && (
                  <CampaignProgressIndicator
                    current={campaign.latestJob.leadsProcessed || 0}
                    total={campaign.maxLeads}
                    status={campaign.latestJob.status}
                    className="mt-4"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Campaign Detail Sheet */}
      <Sheet open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="font-mono">
              {selectedCampaignData?.name}
            </SheetTitle>
          </SheetHeader>
          
          {selectedCampaignData && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-3">
                <CampaignStatusBadge 
                  status={selectedCampaignStatus?.latestJob?.status || 'PENDING'} 
                />
                {selectedCampaignStatus?.latestJob?.status === 'RUNNING' && (
                  <span className="text-sm text-muted-foreground">
                    Processing leads...
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-mono font-bold mb-2">Campaign Details</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Target:</strong> {selectedCampaignData.nicheOrJobTitle}</div>
                    <div><strong>Location:</strong> {selectedCampaignData.location}</div>
                    <div><strong>Max Leads:</strong> {selectedCampaignData.maxLeads.toLocaleString()}</div>
                    {selectedCampaignData.keywords && (
                      <div><strong>Keywords:</strong> {selectedCampaignData.keywords}</div>
                    )}
                  </div>
                </div>

                {selectedCampaignStatus && (
                  <CampaignMetrics
                    totalLeads={selectedCampaignStatus.totalLeads}
                    leadsProcessed={selectedCampaignStatus.latestJob?.leadsProcessed}
                    leadsWritten={selectedCampaignStatus.latestJob?.leadsWritten}
                    totalPages={selectedCampaignStatus.latestJob?.totalPages}
                    status={selectedCampaignStatus.latestJob?.status}
                  />
                )}

                {selectedCampaignStatus?.latestJob?.status === 'RUNNING' && (
                  <CampaignProgressIndicator
                    current={selectedCampaignStatus.latestJob.leadsProcessed || 0}
                    total={selectedCampaignData.maxLeads}
                    status={selectedCampaignStatus.latestJob.status}
                  />
                )}

                {selectedCampaignStatus?.latestJob?.lastError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="text-sm font-medium text-red-800 mb-1">Last Error</div>
                    <div className="text-sm text-red-700">
                      {selectedCampaignStatus.latestJob.lastError}
                    </div>
                    {selectedCampaignStatus.latestJob.status === 'FAILED' && (
                      <Button 
                        onClick={() => handleRetry(selectedCampaignData.id)}
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        disabled={loading}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry Campaign
                      </Button>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      const url = `https://docs.google.com/spreadsheets/d/${selectedCampaignData.googleSheet.spreadsheetId}`
                      window.open(url, '_blank')
                    }}
                  >
                    Open Google Sheet
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Campaign Form */}
      <CreateCampaignForm
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        onSuccess={handleCampaignCreated}
      />
    </div>
  )
}
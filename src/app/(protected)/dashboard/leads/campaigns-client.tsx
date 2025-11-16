"use client"

import { useState } from 'react'
import { Plus, RefreshCw, Pause, Play } from 'lucide-react'
import { LoaderThree } from '@/components/ui/loader'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'

import { CampaignStatusBadge } from '@/components/campaigns/CampaignStatusBadge'
import { CampaignActions } from '@/components/campaigns/CampaignActions'
import { CampaignProgressIndicator } from '@/components/campaigns/CampaignProgressIndicator'
import { CreateCampaignForm } from '@/components/campaigns/createCampaignForm'
import { useCampaigns } from '@/hooks/useCampaigns'

import { formatRelativeTime } from '@/lib/utils'
import type { CampaignListResponse, Campaign } from '@/lib/apollo/campaigns'

interface CampaignsClientProps {
  initialData: CampaignListResponse
}

export function CampaignsClient({ initialData }: CampaignsClientProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const router = useRouter()

  const {
    campaigns,
    loading,
    error,
    refreshing,
    fetchCampaigns,
    updateCampaign,
    deleteCampaign,
    retryCampaign,
  } = useCampaigns(initialData)

  const handleRefresh = async () => {
    await fetchCampaigns({ skipLoading: true })
    toast.success('Campaigns refreshed')
  }

  const handleToggleActive = async (campaignId: string, isActive: boolean) => {
    try {
      await updateCampaign(campaignId, { isActive })
    } catch (error) {
      console.error('Failed to toggle campaign activity', error)
    }
  }

  const handleRetry = async (campaignId: string) => {
    try {
      await retryCampaign(campaignId)
    } catch (error) {
      console.error('Failed to retry campaign', error)
    }
  }

  const handleDelete = async (campaignId: string) => {
    const confirmation = window.confirm(
      'Are you sure you want to delete this campaign? This action cannot be undone.'
    )

    if (!confirmation) return

    try {
      await deleteCampaign(campaignId)
    } catch (error) {
      console.error('Failed to delete campaign', error)
    }
  }

  const handleCampaignCreated = async () => {
    await fetchCampaigns({ skipLoading: true })
  }

  const handleNavigateToCampaign = (campaignId: string) => {
    router.push(`/dashboard/leads/${campaignId}`)
  }

  const renderCampaignRow = (campaign: Campaign) => {
    const status = campaign.latestJob?.status || 'PENDING'
    const leadsProcessed = campaign.latestJob?.leadsProcessed ?? 0
    const leadsWritten = campaign.latestJob?.leadsWritten ?? 0
    const hasError = Boolean(campaign.latestJob?.lastError)
    const updatedAt = campaign.updatedAt ? new Date(campaign.updatedAt) : null

    return (
      <div
        key={campaign.id}
        onClick={() => handleNavigateToCampaign(campaign.id)}
        className="grid gap-4 px-4 py-3 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_auto] md:items-center"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-semibold text-foreground md:text-base">
              {campaign.name}
            </p>
            <CampaignStatusBadge status={status} />
            {!campaign.isActive && status !== 'RUNNING' && (
              <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                Paused
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground md:text-sm">
            <span className="truncate">Target: {campaign.nicheOrJobTitle}</span>
            <span className="truncate">Location: {campaign.location}</span>
            <span>
              Mode: {campaign.searchMode === 'conserve' ? 'Credit saver' : 'Balanced'}
            </span>
          </div>
          {campaign.keywords && (
            <div className="text-xs text-muted-foreground md:text-sm">
              Keywords: {campaign.keywords}
            </div>
          )}
          <div className="text-xs text-muted-foreground md:text-sm">
            Sheet: {campaign.googleSheet.title}
          </div>
          {updatedAt && (
            <div className="text-xs text-muted-foreground">
              Updated {formatRelativeTime(updatedAt)}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <CampaignProgressIndicator
            current={
              status === 'SUCCEEDED'
                ? campaign.maxLeads
                : leadsProcessed
            }
            total={campaign.maxLeads}
            status={status}
          />
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground md:text-sm">
            <span>Processed: {leadsProcessed.toLocaleString()}</span>
            <span>Written: {leadsWritten.toLocaleString()}</span>
            <span>Total leads: {campaign.totalLeads.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-2 text-xs text-muted-foreground md:text-sm">
          {campaign.latestJob?.startedAt && (
            <div>Started {formatRelativeTime(new Date(campaign.latestJob.startedAt))}</div>
          )}
          {campaign.latestJob?.finishedAt && (
            <div>Finished {formatRelativeTime(new Date(campaign.latestJob.finishedAt))}</div>
          )}
          {hasError && (
            <div className="font-medium text-status-negative">
              Error: {campaign.latestJob?.lastError}
            </div>
          )}
        </div>

        <div
          className="ml-auto flex flex-col items-end gap-2 md:flex-row"
          onClick={(event) => event.stopPropagation()}
        >
          {status === 'RUNNING' && campaign.isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleToggleActive(campaign.id, false)}
            >
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          )}
          {!campaign.isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleToggleActive(campaign.id, true)}
            >
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          )}
          <CampaignActions
            campaign={campaign}
            latestJobStatus={campaign.latestJob?.status}
            onToggleActive={handleToggleActive}
            onRetry={handleRetry}
            onDelete={handleDelete}
            disabled={loading}
          />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Error loading campaigns</p>
          <p>{error}</p>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground">
            Server-rendered Leads campaigns load instantly and refresh every few seconds.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create campaign
          </Button>
        </div>
      </div>

      {loading && campaigns.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border/60">
          <div className="flex flex-col items-center gap-3">
            <LoaderThree />
            <span className="sr-only">Loading campaigns…</span>
          </div>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 text-center">
          <h3 className="text-lg font-semibold text-foreground">No campaigns yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create your first campaign to start fetching Apollo leads automatically.
          </p>
          <Button className="mt-4" onClick={() => setShowCreateForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create first campaign
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
          <div className="hidden bg-muted/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_auto]">
            <span>Campaign</span>
            <span>Progress</span>
            <span>Timeline</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-border/60">
            {campaigns.map(renderCampaignRow)}
          </div>
        </div>
      )}

      <CreateCampaignForm
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        onSuccess={handleCampaignCreated}
      />
    </div>
  )
}

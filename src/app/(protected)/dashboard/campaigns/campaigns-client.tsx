"use client"

import { useMemo, useState } from 'react'
import { Loader2, Plus, RefreshCw, Pause, Play } from 'lucide-react'
import { LoaderThree } from '@/components/ui/loader'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'

import { CampaignStatusBadge } from '@/components/campaigns/CampaignStatusBadge'
import { CampaignActions } from '@/components/campaigns/CampaignActions'
import { CampaignProgressIndicator } from '@/components/campaigns/CampaignProgressIndicator'
import { CreateCampaignForm } from '@/components/campaigns/createCampaignForm'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useCampaignStatus } from '@/hooks/useCampaignStatus'

import { formatRelativeTime } from '@/lib/utils'
import type { CampaignListResponse, Campaign } from '@/lib/apollo/campaigns'

interface CampaignsClientProps {
  initialData: CampaignListResponse
}

export function CampaignsClient({ initialData }: CampaignsClientProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

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

  const {
    status: selectedCampaignStatus,
    refetch: refetchCampaignStatus,
    stopPolling,
  } = useCampaignStatus(selectedCampaign || '', 4000)

  const selectedCampaignData = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaign) ?? null,
    [campaigns, selectedCampaign]
  )

  const handleRefresh = async () => {
    await fetchCampaigns({ skipLoading: true })
    toast.success('Campaigns refreshed')
  }

  const handleToggleActive = async (campaignId: string, isActive: boolean) => {
    try {
      await updateCampaign(campaignId, { isActive })
      if (campaignId === selectedCampaign) {
        await refetchCampaignStatus()
      }
    } catch (error) {
      console.error('Failed to toggle campaign activity', error)
    }
  }

  const handleRetry = async (campaignId: string) => {
    try {
      await retryCampaign(campaignId)
      if (campaignId === selectedCampaign) {
        await refetchCampaignStatus()
      }
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
      if (campaignId === selectedCampaign) {
        setSelectedCampaign(null)
        stopPolling()
      }
    } catch (error) {
      console.error('Failed to delete campaign', error)
    }
  }

  const handleCampaignCreated = async () => {
    await fetchCampaigns({ skipLoading: true })
  }

  const handleSelectCampaign = (campaignId: string) => {
    setSelectedCampaign(campaignId)
  }

  const closeSheet = () => {
    setSelectedCampaign(null)
    stopPolling()
  }

  const renderCampaignRow = (campaign: Campaign) => {
    const isSelected = campaign.id === selectedCampaign
    const status = campaign.latestJob?.status || 'PENDING'
    const leadsProcessed = campaign.latestJob?.leadsProcessed ?? 0
    const leadsWritten = campaign.latestJob?.leadsWritten ?? 0
    const hasError = Boolean(campaign.latestJob?.lastError)
    const updatedAt = campaign.updatedAt ? new Date(campaign.updatedAt) : null

    return (
      <div
        key={campaign.id}
        onClick={() => handleSelectCampaign(campaign.id)}
        className={`grid gap-4 px-4 py-3 transition-colors md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_auto] md:items-center ${
          isSelected ? 'bg-muted/50' : 'hover:bg-muted/40'
        }`}
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
          <h1 className="text-3xl font-mono font-bold text-foreground">Campaigns</h1>
          <p className="text-muted-foreground">
            Server-rendered campaigns load instantly and refresh every few seconds.
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

      <Sheet open={!!selectedCampaign} onOpenChange={closeSheet}>
        <SheetContent className="w-full overflow-y-auto border-l border-border bg-background sm:w-[520px]">
          {selectedCampaignData && (
            <div className="space-y-6 pb-4">
              <SheetHeader className="space-y-3 pt-2 text-left">
                <SheetTitle className="flex flex-wrap items-center gap-3 text-2xl">
                  {selectedCampaignData.name}
                  <CampaignStatusBadge
                    status={selectedCampaignStatus?.latestJob?.status || selectedCampaignData.latestJob?.status || 'PENDING'}
                  />
                  {!selectedCampaignData.isActive && (
                    <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                      Paused
                    </Badge>
                  )}
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  Synced sheet: {selectedCampaignData.googleSheet.title}
                </p>
              </SheetHeader>

              {selectedCampaignStatus?.latestJob?.status === 'RUNNING' && (
                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching leads and writing them to your Google Sheet in real time.
                </div>
              )}

              <section className="space-y-3 rounded-lg border border-border/60 p-4">
                <h3 className="font-mono text-sm font-semibold tracking-wide text-muted-foreground">
                  Campaign configuration
                </h3>
                <div className="grid gap-2 text-sm text-foreground">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target roles</span>
                    <span className="font-medium text-right">{selectedCampaignData.nicheOrJobTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Locations</span>
                    <span className="font-medium text-right">{selectedCampaignData.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max leads</span>
                    <span className="font-medium">{selectedCampaignData.maxLeads.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mode</span>
                    <span className="font-medium">
                      {selectedCampaignData.searchMode === 'conserve' ? 'Credit saver' : 'Balanced'}
                    </span>
                  </div>
                  {selectedCampaignData.keywords && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Keywords</span>
                      <span className="max-w-[220px] text-right font-medium">
                        {selectedCampaignData.keywords}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border/60 p-4">
                <h3 className="font-mono text-sm font-semibold tracking-wide text-muted-foreground">
                  Live progress
                </h3>

                <CampaignProgressIndicator
                  current={
                    selectedCampaignStatus?.latestJob?.status === 'SUCCEEDED'
                      ? selectedCampaignData.maxLeads
                      : selectedCampaignStatus?.latestJob?.leadsProcessed ??
                        selectedCampaignData.latestJob?.leadsProcessed ??
                        0
                  }
                  total={selectedCampaignData.maxLeads}
                  status={
                    selectedCampaignStatus?.latestJob?.status ||
                    selectedCampaignData.latestJob?.status ||
                    'PENDING'
                  }
                />

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Processed</p>
                    <p className="font-mono text-lg font-semibold">
                      {(
                        selectedCampaignStatus?.latestJob?.leadsProcessed ??
                        selectedCampaignData.latestJob?.leadsProcessed ??
                        0
                      ).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Written</p>
                    <p className="font-mono text-lg font-semibold">
                      {(
                        selectedCampaignStatus?.latestJob?.leadsWritten ??
                        selectedCampaignData.latestJob?.leadsWritten ??
                        0
                      ).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total leads</p>
                    <p className="font-mono text-lg font-semibold">
                      {(selectedCampaignStatus?.totalLeads ?? selectedCampaignData.totalLeads).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Attempts</p>
                    <p className="font-mono text-lg font-semibold">
                      {selectedCampaignStatus?.latestJob?.attemptCount ??
                        selectedCampaignData.latestJob?.attemptCount ??
                        0}
                    </p>
                  </div>
                </div>

                {selectedCampaignStatus?.latestJob?.lastError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <p className="font-medium text-red-800">Last error</p>
                    <p className="mt-1 leading-relaxed">
                      {selectedCampaignStatus.latestJob.lastError}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => handleRetry(selectedCampaignData.id)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry campaign
                    </Button>
                  </div>
                )}
              </section>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = `https://docs.google.com/spreadsheets/d/${selectedCampaignData.googleSheet.spreadsheetId}`
                    window.open(url, '_blank')
                  }}
                >
                  Open Google Sheet
                </Button>

                {selectedCampaignStatus?.latestJob?.status === 'RUNNING' && selectedCampaignData.isActive && (
                  <Button
                    variant="destructive"
                    onClick={() => handleToggleActive(selectedCampaignData.id, false)}
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Pause campaign
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CreateCampaignForm
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        onSuccess={handleCampaignCreated}
      />
    </div>
  )
}

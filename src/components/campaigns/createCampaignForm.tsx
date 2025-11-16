// src/components/CreateCampaignForm.tsx
'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SheetSelector } from '@/components/google-sheet/SheetSelector'
import { toast } from 'sonner'
import { validateCampaignData } from '@/lib/utils'
import { useGoogleSheets } from '@/hooks/useGoogleSheet'
import { ConnectionStatus } from '@/components/google-sheet/ConnectionStatus'
import { ConnectionActions } from '@/components/google-sheet/ConnectionActions'
import { createCampaignAction } from '@/actions/campaigns'

interface CreateCampaignFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (campaign: unknown) => void
}

interface FormData {
  name: string
  jobTitles: string[] // Array of job titles
  keywords: string // Comma-separated keywords
  locations: string[] // Array of locations
  googleSheetId: string
  maxLeads: number
  pageSize: number
  searchMode: 'balanced' | 'conserve'
  includeDomains?: string // Optional domain filters (comma-separated)
  excludeDomains?: string // Optional domain exclusions (comma-separated)
}

export function CreateCampaignForm({ open, onOpenChange, onSuccess }: CreateCampaignFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    jobTitles: [''],
    keywords: '',
    locations: [''],
    googleSheetId: '',
    maxLeads: 1000,
    pageSize: 25,
    searchMode: 'balanced',
    includeDomains: '',
    excludeDomains: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [, startTransition] = useTransition()

  const { 
    status,
    spreadsheets, 
    loading,
    error,
    setError,
    checkConnectionStatus,
    connectGoogleAccount,
    disconnectGoogleAccount,
    fetchSpreadsheets
  } = useGoogleSheets()
<<<<<<< HEAD
=======
  // Check connection status when modal opens
  useEffect(() => {
    if (open) {
      void checkConnectionStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Fetch spreadsheets when connected
  useEffect(() => {
    if (status?.isConnected && !status?.isExpired && spreadsheets.length === 0) {
      console.log('Status is connected, fetching spreadsheets...')
      void fetchSpreadsheets()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, spreadsheets.length])

  useEffect(() => () => {
    submitCancelRef.current?.cancel('Component unmounted')
  }, [])
>>>>>>> origin/main

  const handleInputChange = (field: keyof FormData, value: string | number | string[]) => {
    setFormData(prev => {
      if (field === 'pageSize' && typeof value === 'number' && prev.searchMode === 'conserve') {
        return { ...prev, pageSize: Math.min(value, 15) }
      }
      return { ...prev, [field]: value } as FormData
    })
    if (errors.length > 0) {
      setErrors([]) // Clear errors when user starts typing
    }
  }

  const handleSearchModeChange = (mode: 'balanced' | 'conserve') => {
    setFormData(prev => ({
      ...prev,
      searchMode: mode,
      pageSize: mode === 'conserve' ? Math.min(prev.pageSize, 15) : prev.pageSize
    }))
    if (errors.length > 0) {
      setErrors([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form data
    const validation = validateCampaignData(formData)
    if (!validation.valid) {
      setErrors(validation.errors)
      if (validation.errors.length > 0) {
        toast.error(validation.errors[0])
      }
      return
    }

    try {
      setSubmitting(true)
      setErrors([])

      const jobTitlesArray = (typeof formData.jobTitles[0] === 'string' 
        ? formData.jobTitles[0].split(',') 
        : formData.jobTitles
      ).map((t: string) => t.trim()).filter(Boolean)

      const locationsArray = (typeof formData.locations[0] === 'string'
        ? formData.locations[0].split(',')
        : formData.locations
      ).map((l: string) => l.trim()).filter(Boolean)

      const apiFormData = {
        name: formData.name.trim(),
        jobTitles: jobTitlesArray,
        locations: locationsArray,
        keywords: formData.keywords?.trim() || '',
        maxLeads: formData.maxLeads || 1000,
        pageSize: formData.pageSize || 25,
        searchMode: formData.searchMode,
        googleSheetId: formData.googleSheetId,
        includeDomains: formData.includeDomains?.trim() || undefined,
        excludeDomains: formData.excludeDomains?.trim() || undefined,
      }

      startTransition(() => {
        createCampaignAction(apiFormData)
          .then((data) => {
            toast.success('Campaign created! Apollo lead fetching has started.')
            onSuccess(data.campaign)
            onOpenChange(false)
            setFormData({
              name: '',
              jobTitles: [''],
              keywords: '',
              locations: [''],
              googleSheetId: '',
              maxLeads: 1000,
              pageSize: 25,
              searchMode: 'balanced',
              includeDomains: '',
              excludeDomains: ''
            })
          })
          .catch((error) => {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create campaign'
            toast.error(errorMessage)
            setErrors([errorMessage])
          })
          .finally(() => {
            setSubmitting(false)
          })
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create campaign'
      toast.error(errorMessage)
      setErrors([errorMessage])
      setSubmitting(false)
    }
  }

  const handleRefreshStatus = () => {
    void checkConnectionStatus()
  }

  const selectedSheet = spreadsheets.find(sheet => sheet.id === formData.googleSheetId)
  const isConnected = status?.isConnected && !status?.isExpired

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-mono">Create New Campaign</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure Apollo search filters. We will fetch leads and append them to your Google Sheet automatically.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="text-sm text-red-800">
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Campaign Details Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-lg">Campaign Details</h3>
            
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Q4 Utility Outreach"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobTitles">Job Titles (comma-separated) *</Label>
              <Textarea
                id="jobTitles"
                value={formData.jobTitles.join(', ')}
                onChange={(e) => {
                  const titles = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  handleInputChange('jobTitles', titles);
                }}
                placeholder="e.g., CEO, Marketing Director, VP of Sales"
                rows={2}
                required
              />
              <p className="text-sm text-muted-foreground">
                Enter target job titles. Multiple variations can help find more leads.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Textarea
                id="keywords"
                value={formData.keywords}
                onChange={(e) => handleInputChange('keywords', e.target.value)}
                placeholder="e.g., SaaS, B2B, enterprise software, lead generation, fintech, healthcare"
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                Enter relevant keywords to refine your lead search.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="locations">Locations (comma-separated) *</Label>
              <Textarea
                id="locations"
                value={formData.locations.join(', ')}
                onChange={(e) => {
                  const locs = e.target.value.split(',').map(l => l.trim()).filter(Boolean);
                  handleInputChange('locations', locs);
                }}
                placeholder="e.g., California, US; New York, US; Toronto, Canada"
                rows={2}
                required
              />
              <p className="text-sm text-muted-foreground">
                Enter target locations in format: City, Country or State, Country
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="includeDomains">Include Domains (comma-separated)</Label>
              <Input
                id="includeDomains"
                value={formData.includeDomains}
                onChange={(e) => handleInputChange('includeDomains', e.target.value)}
                placeholder="e.g., company1.com, company2.com"
              />
              <p className="text-sm text-muted-foreground">
                Optional: Only include leads from these domains
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excludeDomains">Exclude Domains (comma-separated)</Label>
              <Input
                id="excludeDomains"
                value={formData.excludeDomains}
                onChange={(e) => handleInputChange('excludeDomains', e.target.value)}
                placeholder="e.g., competitor1.com, competitor2.com"
              />
              <p className="text-sm text-muted-foreground">
                Optional: Exclude leads from these domains
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxLeads">Max Leads to Fetch</Label>
              <Input
                id="maxLeads"
                type="number"
                min="1"
                max="10000"
                value={formData.maxLeads}
                onChange={(e) => handleInputChange('maxLeads', parseInt(e.target.value) || 1000)}
              />
              <p className="text-sm text-muted-foreground">
                Maximum number of leads to fetch (1-10,000)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pageSize">Leads Per Request</Label>
              <Input
                id="pageSize"
                type="number"
                min="1"
                max="100"
                value={formData.pageSize}
                onChange={(e) => handleInputChange('pageSize', Math.max(1, Math.min(100, parseInt(e.target.value) || 25)))}
              />
              <p className="text-sm text-muted-foreground">
                How many leads to request from Apollo per API call (1-100). Smaller batches help avoid rate limits.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Credit Usage Mode</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {[{
                  value: 'balanced' as const,
                  title: 'Balanced coverage',
                  description: 'Requests larger pages and scans deeper to maximise leads.'
                }, {
                  value: 'conserve' as const,
                  title: 'Credit saver',
                  description: 'Uses smaller page sizes, caps search depth, and stops sooner when results dry up.'
                }].map(option => {
                  const isActive = formData.searchMode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSearchModeChange(option.value)}
                      className={`text-left border rounded-md p-3 transition-colors ${isActive ? 'border-blue-500 bg-blue-50' : 'border-border hover:border-blue-200'}`}
                    >
                      <div className="font-medium text-sm">{option.title}</div>
                      <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Google Sheets Section */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-medium text-lg">Google Sheets Integration</h3>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="float-right text-red-700 hover:text-red-900"
                >
                  ×
                </button>
              </div>
            )}

            <ConnectionStatus status={status} />
            
            <ConnectionActions
              status={status}
              loading={loading}
              onConnect={connectGoogleAccount}
              onDisconnect={disconnectGoogleAccount}
              onFetchSpreadsheets={() => {
                void fetchSpreadsheets({ force: true })
              }}
              onRefreshStatus={handleRefreshStatus}
            />

            {isConnected && (
              <div className="space-y-2">
                <Label htmlFor="googleSheet">Select Google Sheet *</Label>
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading Google Sheets...</div>
                ) : spreadsheets.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No spreadsheets found. Create a Google Sheet first or click the Fetch Spreadsheets button above.
                  </div>
                ) : (
                  <SheetSelector
                    sheets={spreadsheets}
                    value={formData.googleSheetId}
                    onChange={(value) => handleInputChange('googleSheetId', value)}
                    disabled={spreadsheets.length === 0}
                    loading={loading}
                    emptyMessage="No sheets match your search."
                  />
                )}
                
                {selectedSheet && (
                  <div className="text-sm text-muted-foreground">
                    Leads will be written to: <strong>{selectedSheet.name}</strong>
                    <br />
                    <a 
                      href={selectedSheet.webViewLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Open in Google Sheets →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || !isConnected || !formData.googleSheetId}
              className="min-w-[120px]"
            >
              {submitting ? 'Launching...' : 'Create Campaign'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

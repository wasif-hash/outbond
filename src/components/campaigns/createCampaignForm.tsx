// src/components/CreateCampaignForm.tsx
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'react-hot-toast'
import { validateCampaignData } from '@/lib/utils'
import { useGoogleSheets } from '@/hooks/useGoogleSheet'
import { ConnectionStatus } from '@/components/google-sheet/ConnectionStatus'
import { ConnectionActions } from '@/components/google-sheet/ConnectionActions'

interface CreateCampaignFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (campaign: any) => void
}

interface FormData {
  name: string
  nicheOrJobTitle: string
  keywords: string
  location: string
  googleSheetId: string
  maxLeads: number
}

export function CreateCampaignForm({ open, onOpenChange, onSuccess }: CreateCampaignFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    nicheOrJobTitle: '',
    keywords: '',
    location: '',
    googleSheetId: '',
    maxLeads: 1000,
  })
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

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

  // Check connection status when modal opens
  useEffect(() => {
    if (open) {
      checkConnectionStatus()
    }
  }, [open])

  // Fetch spreadsheets when connected
  useEffect(() => {
    if (status?.isConnected && !status?.isExpired && spreadsheets.length === 0) {
      console.log('Status is connected, fetching spreadsheets...')
      fetchSpreadsheets()
    }
  }, [status, spreadsheets.length])

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors.length > 0) {
      setErrors([]) // Clear errors when user starts typing
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form data
    const validation = validateCampaignData(formData)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    try {
      setSubmitting(true)
      setErrors([])

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create campaign')
      }

      const data = await response.json()
      
      toast.success('Campaign created! Lead fetching has started.')
      onSuccess(data.campaign)
      onOpenChange(false)
      
      // Reset form
      setFormData({
        name: '',
        nicheOrJobTitle: '',
        keywords: '',
        location: '',
        googleSheetId: '',
        maxLeads: 1000,
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create campaign'
      toast.error(errorMessage)
      setErrors([errorMessage])
    } finally {
      setSubmitting(false)
    }
  }

  const handleRefreshStatus = () => {
    checkConnectionStatus()
  }

  const selectedSheet = spreadsheets.find(sheet => sheet.id === formData.googleSheetId)
  const isConnected = status?.isConnected && !status?.isExpired

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-mono">Create New Campaign</DialogTitle>
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
              <Label htmlFor="nicheOrJobTitle">Niche / Job Title *</Label>
              <Input
                id="nicheOrJobTitle"
                value={formData.nicheOrJobTitle}
                onChange={(e) => handleInputChange('nicheOrJobTitle', e.target.value)}
                placeholder="e.g., CEO, Marketing Director, Software Engineer"
                required
              />
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
                Enter relevant keywords to refine your lead search. These will be used to find companies in your target industry.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="e.g., United States, California, New York"
                required
              />
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
              onFetchSpreadsheets={fetchSpreadsheets}
              onRefreshStatus={handleRefreshStatus}
            />

            {isConnected && (
              <div className="space-y-2">
                <Label htmlFor="googleSheet">Select Google Sheet *</Label>
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading Google Sheets...</div>
                ) : spreadsheets.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No spreadsheets found. Create a Google Sheet first or click "Fetch Spreadsheets" above.
                  </div>
                ) : (
                  <Select 
                    value={formData.googleSheetId} 
                    onValueChange={(value) => handleInputChange('googleSheetId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a Google Sheet" />
                    </SelectTrigger>
                    <SelectContent>
                      {spreadsheets.map((sheet) => (
                        <SelectItem key={sheet.id} value={sheet.id}>
                          {sheet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              {submitting ? 'Creating...' : 'Create Campaign'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
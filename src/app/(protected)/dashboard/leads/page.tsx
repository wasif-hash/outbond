"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { MutableRefObject } from "react"
import axios, { CancelTokenSource } from "axios"
import { Search, Send, Eye, Loader2, RefreshCw, Download } from "lucide-react"

import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

import { ErrorAlert } from "@/components/google-sheet/ErrorAlert"

import { useGoogleSheets } from "@/hooks/useGoogleSheet"
import { useGmail } from "@/hooks/useGmail"
import { LEAD_SHEET_COLUMNS } from "@/lib/utils"
import type { SpreadsheetData } from "@/types/google-sheet"

type OutreachMode = "single" | "bulk"

type SheetLead = {
  rowIndex: number
  email: string
  firstName?: string
  lastName?: string
  company?: string
  summary?: string
  role?: string
}

type DraftStatus = "pending" | "queued" | "sent" | "failed"

type DraftRecord = {
  subject: string
  body: string
  status: DraftStatus
  error?: string
}

type OutreachedJob = {
  id: string
  leadEmail: string
  leadFirstName?: string | null
  leadLastName?: string | null
  leadCompany?: string | null
  leadSummary?: string | null
  subject: string
  bodyHtml: string
  bodyText?: string | null
  status: string
  sheetRowRef?: string | null
  sentAt?: string | null
  createdAt: string
}

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState("")

  const [showOutreach, setShowOutreach] = useState(false)
  const [sendingMode, setSendingMode] = useState<OutreachMode>("single")
  const [selectedSheetId, setSelectedSheetId] = useState<string>('')
  const [sheetRange, setSheetRange] = useState('')
  const [sheetLeads, setSheetLeads] = useState<SheetLead[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftRecord>>({})
  const [valueProp, setValueProp] = useState("")
  const [callToAction, setCallToAction] = useState("Would you be open to a 15 minute chat later this week?")
  const [generatingDrafts, setGeneratingDrafts] = useState(false)
  const [sendingEmails, setSendingEmails] = useState(false)

  const [previewEmail, setPreviewEmail] = useState<string | null>(null)
  const [outreachedJobs, setOutreachedJobs] = useState<OutreachedJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [previewJob, setPreviewJob] = useState<OutreachedJob | null>(null)

  const generateCancelSourceRef = useRef<CancelTokenSource | null>(null)
  const sendCancelSourceRef = useRef<CancelTokenSource | null>(null)
  const jobsCancelSourceRef = useRef<CancelTokenSource | null>(null)

  const prepareCancelSource = useCallback((ref: MutableRefObject<CancelTokenSource | null>) => {
    if (ref.current) {
      ref.current.cancel('Cancelled due to a new request')
    }
    const nextSource = axios.CancelToken.source()
    ref.current = nextSource
    return nextSource
  }, [])

  useEffect(() => {
    return () => {
      generateCancelSourceRef.current?.cancel('Component unmounted')
      sendCancelSourceRef.current?.cancel('Component unmounted')
      jobsCancelSourceRef.current?.cancel('Component unmounted')
    }
  }, [])

  const {
    spreadsheets,
    selectedSheet,
    loading: sheetsLoading,
    error: sheetsError,
    setError: setSheetsError,
    checkConnectionStatus,
    fetchSpreadsheets,
    fetchSheetData,
  } = useGoogleSheets()

  const {
    status: gmailStatus,
    connect: connectGmail,
    refreshStatus: refreshGmailStatus,
    statusLoading: gmailStatusLoading,
    lastFetched: gmailStatusLastFetched,
  } = useGmail()

  useEffect(() => {
    checkConnectionStatus().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedSheetId && spreadsheets.length > 0) {
      setSelectedSheetId(spreadsheets[0].id)
    }
  }, [spreadsheets, selectedSheetId])

  useEffect(() => {
    if (!selectedSheet) {
      setSheetLeads([])
      return
    }
    const leads = parseSheet(selectedSheet)
    setSheetLeads(leads)
    setDrafts({})
    setSheetsError(null)
  }, [selectedSheet, setSheetsError])

  const filteredLeads = sheetLeads.filter((lead) => {
    if (!searchTerm.trim()) return true
    const searchLower = searchTerm.toLowerCase()
    const first = (lead.firstName ?? '').toLowerCase()
    const last = (lead.lastName ?? '').toLowerCase()
    const fullName = `${first} ${last}`.trim()
    const nameMatches = fullName.includes(searchLower)
    const companyMatches = (lead.company ?? '').toLowerCase().includes(searchLower)
    const emailMatches = lead.email.toLowerCase().includes(searchLower)
    return nameMatches || companyMatches || emailMatches
  })

  const filteredOutreachedJobs = useMemo(() => {
    if (!searchTerm.trim()) return outreachedJobs
    const query = searchTerm.toLowerCase()
    return outreachedJobs.filter((job) => {
      const fields = [
        job.leadEmail,
        job.leadFirstName ?? '',
        job.leadLastName ?? '',
        job.leadCompany ?? '',
        job.subject,
      ]
      return fields.some((value) => value?.toLowerCase().includes(query))
    })
  }, [outreachedJobs, searchTerm])

  const outreachDraft = previewEmail ? drafts[previewEmail] : null
  const previewLead = useMemo(() => sheetLeads.find((lead) => lead.email === previewEmail), [previewEmail, sheetLeads])

  const handleSheetSelectOpen = useCallback((open: boolean) => {
    if (open && !spreadsheets.length && !sheetsLoading) {
      fetchSpreadsheets().catch(() => undefined)
    }
  }, [fetchSpreadsheets, sheetsLoading, spreadsheets.length])

  const fetchOutreachedJobs = useCallback(async () => {
    setJobsLoading(true)
    let cancelSource: CancelTokenSource | null = null
    try {
      cancelSource = prepareCancelSource(jobsCancelSourceRef)
      const response = await axios.get<{ jobs: OutreachedJob[] }>(
        '/api/email/outreach/jobs',
        { cancelToken: cancelSource.token },
      )
      setOutreachedJobs(response.data.jobs ?? [])
    } catch (error) {
      if (axios.isCancel(error)) {
        return
      }
      console.error('Fetch outreached jobs error:', error)
      toast.error('Failed to load outreached emails')
    } finally {
      if (cancelSource && jobsCancelSourceRef.current === cancelSource) {
        jobsCancelSourceRef.current = null
      }
      setJobsLoading(false)
    }
  }, [prepareCancelSource])

  const handleExportOutreachedCsv = useCallback(() => {
    if (!outreachedJobs.length || typeof window === 'undefined') {
      return
    }

    const headers = [
      'Email',
      'First Name',
      'Last Name',
      'Company',
      'Subject',
      'Status',
      'Sent At',
      'Created At',
      'Body HTML',
      'Body Text',
    ]

    const escape = (value: string | null | undefined) => {
      const stringValue = value ?? ''
      const escaped = stringValue.replace(/"/g, '""')
      return `"${escaped}"`
    }

    const rows = outreachedJobs.map((job) => [
      escape(job.leadEmail),
      escape(job.leadFirstName ?? ''),
      escape(job.leadLastName ?? ''),
      escape(job.leadCompany ?? ''),
      escape(job.subject),
      escape(job.status),
      escape(job.sentAt ? new Date(job.sentAt).toISOString() : ''),
      escape(new Date(job.createdAt).toISOString()),
      escape(job.bodyHtml),
      escape(job.bodyText ?? ''),
    ])

    const csvRows = [
      headers.map((header) => escape(header)).join(','),
      ...rows.map((row) => row.join(',')),
    ]
    const csv = csvRows.join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `outreached-emails-${new Date().toISOString()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }, [outreachedJobs])

  useEffect(() => {
    fetchOutreachedJobs().catch(() => undefined)
  }, [fetchOutreachedJobs])

  const handleLoadSheet = async () => {
    if (!selectedSheetId) {
      setSheetsError('Please choose a Google Sheet first')
      return
    }
    const trimmedRange = sheetRange.trim()
    const rangeToUse = trimmedRange.length > 0 ? trimmedRange : undefined
    const data = await fetchSheetData(selectedSheetId, rangeToUse)
    if (data?.sheets?.length) {
      const firstTab = data.sheets[0]?.title || 'Sheet1'
      if (!rangeToUse) {
        setSheetRange(`${firstTab}!A:P`)
      }
    }
  }

  const handleGenerateDrafts = async () => {
    if (!sheetLeads.length) {
      setSheetsError('No leads available to generate drafts')
      return
    }

    setGeneratingDrafts(true)
    let cancelSource: CancelTokenSource | null = null
    try {
      cancelSource = prepareCancelSource(generateCancelSourceRef)
      setDrafts({})

      for (const lead of sheetLeads) {
        const response = await axios.post<{ drafts: Array<{ email: string; subject: string; body: string }> }>(
          '/api/email/outreach/draft',
          {
            leads: [
              {
                email: lead.email,
                firstName: lead.firstName,
                lastName: lead.lastName,
                company: lead.company,
                summary: lead.summary,
                role: lead.role,
              },
            ],
            sender: {
              name: gmailStatus?.emailAddress?.split('@')[0] || undefined,
              company: undefined,
              valueProp: valueProp || undefined,
              callToAction: callToAction || undefined,
            },
          },
          { cancelToken: cancelSource.token },
        )

        const generated = response.data.drafts?.[0]
        const draftRecord: DraftRecord = {
          subject: generated?.subject?.trim() || 'Quick intro?',
          body: generated?.body?.trim() || '',
          status: 'pending',
        }

        setDrafts((prev) => ({
          ...prev,
          [lead.email]: draftRecord,
        }))
      }

      const sheetTitle = selectedSheet?.spreadsheet?.properties?.title?.trim() || 'Google Sheet'
      toast.success(`Generated ${sheetLeads.length} drafts from ${sheetTitle}`)
    } catch (error) {
      if (axios.isCancel(error)) {
        return
      }
      console.error('Draft generation error:', error)
      setSheetsError('Failed to generate outreach drafts')
    } finally {
      if (cancelSource && generateCancelSourceRef.current === cancelSource) {
        generateCancelSourceRef.current = null
      }
      setGeneratingDrafts(false)
    }
  }

  const queueEmails = async (emails: string[]) => {
    if (!emails.length) return
    setSendingEmails(true)
    let cancelSource: CancelTokenSource | null = null
    try {
      const jobs = emails
        .map((email) => {
          const lead = sheetLeads.find((l) => l.email === email)
          const draft = drafts[email]
          if (!lead || !draft) return null
          return {
            email,
            subject: draft.subject,
            bodyHtml: draft.body,
            firstName: lead.firstName,
            lastName: lead.lastName,
            company: lead.company,
            summary: lead.summary,
            sheetRowRef: `${lead.rowIndex}`,
          }
        })
        .filter(Boolean)

      if (!jobs.length) {
        setSheetsError('No drafts available for the selected leads')
        return
      }

      cancelSource = prepareCancelSource(sendCancelSourceRef)

      await axios.post('/api/email/outreach/send', { jobs }, { cancelToken: cancelSource.token })

      setDrafts((prev) => {
        const next = { ...prev }
        emails.forEach((email) => {
          if (next[email]) {
            next[email] = { ...next[email], status: 'sent', error: undefined }
          }
        })
        return next
      })
      toast.success(`${jobs.length} email${jobs.length === 1 ? '' : 's'} queued for sending`)
    } catch (error) {
      if (axios.isCancel(error)) {
        return
      }
      console.error('Email queue error:', error)
      setSheetsError('Failed to queue outreach emails')
      setDrafts((prev) => {
        const next = { ...prev }
        emails.forEach((email) => {
          if (next[email]) {
            next[email] = { ...next[email], status: 'failed', error: (error as Error)?.message }
          }
        })
        return next
      })
    } finally {
      if (cancelSource && sendCancelSourceRef.current === cancelSource) {
        sendCancelSourceRef.current = null
      }
      setSendingEmails(false)
    }
  }

  const sendSingleEmail = (email: string) => {
    if (sendingMode !== 'single') return
    const draft = drafts[email]
    if (!draft || draft.status === 'sent') return
    queueEmails([email])
  }
  const sendBulkEmails = () => {
    if (sendingMode !== 'bulk') return
    const pendingEmails = Object.entries(drafts)
      .filter(([, draft]) => draft.status === 'pending')
      .map(([email]) => email)
    queueEmails(pendingEmails)
  }

  const outreachUnavailable = !gmailStatus?.isConnected

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-mono font-bold text-foreground">Leads</h1>
        <p className="text-muted-foreground">Import, enrich, and engage your outbound database</p>
      </div>

      <Card className="space-y-0">
        <CardContent className="pt-6">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads and outreached emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-mono">Outreach Automation</CardTitle>
            <p className="text-sm text-muted-foreground">Draft and send Gemini-personalised outreach directly from Gmail.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={gmailStatus?.isConnected ? 'positive' : 'neutral'}>
              {gmailStatus?.isConnected ? `Gmail Connected${gmailStatus.emailAddress ? ` · ${gmailStatus.emailAddress}` : ''}` : 'Gmail Not Connected'}
            </Badge>
            {gmailStatus?.isConnected && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => refreshGmailStatus().catch(() => undefined)}
                disabled={gmailStatusLoading}
              >
                {gmailStatusLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh Gmail
              </Button>
            )}
            {!gmailStatus?.isConnected && (
              <Button size="sm" variant="outline" onClick={connectGmail}>
                Connect Gmail
              </Button>
            )}
            {gmailStatusLastFetched && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Last checked {new Date(gmailStatusLastFetched).toLocaleString()}
              </span>
            )}
            <Button size="sm" onClick={() => setShowOutreach((prev) => !prev)}>
              {showOutreach ? 'Hide Outreach Panel' : 'Open Outreach Panel'}
            </Button>
          </div>
        </CardHeader>
        {showOutreach && (
          <CardContent className="space-y-6">
            {outreachUnavailable && (
              <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Connect Gmail in Settings or use the button above to enable sending.
              </div>
            )}

            {sheetsError && (
              <ErrorAlert error={sheetsError} onClose={() => setSheetsError(null)} />
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Google Sheet</label>
                <Select
                  value={selectedSheetId}
                  onValueChange={(value) => {
                    setSelectedSheetId(value)
                    setSheetRange('')
                  }}
                  onOpenChange={handleSheetSelectOpen}
                  disabled={spreadsheets.length === 0 && sheetsLoading}
                >
                  <SelectTrigger className="w-full justify-between">
                    <SelectValue placeholder={spreadsheets.length ? 'Select sheet' : sheetsLoading ? 'Loading sheets…' : 'No sheets saved'} />
                    {sheetsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </SelectTrigger>
                  <SelectContent>
                    {spreadsheets.map((sheet) => (
                      <SelectItem key={sheet.id} value={sheet.id}>
                        {sheet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Range</label>
                <Input
                  value={sheetRange}
                  onChange={(event) => setSheetRange(event.target.value)}
                  placeholder="Sheet1!A:P"
                />
                <p className="text-xs text-muted-foreground">Use `Tab!A:Z` to limit rows.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Actions</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleLoadSheet}
                    disabled={sheetsLoading || !selectedSheetId}
                  >
                    {sheetsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load data'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={sendingMode === 'single' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSendingMode('single')}
              >
                Single send
              </Button>
              <Button
                type="button"
                variant={sendingMode === 'bulk' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSendingMode('bulk')}
              >
                Bulk send
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Value prop (optional)</label>
                <Textarea
                  value={valueProp}
                  onChange={(event) => setValueProp(event.target.value)}
                  placeholder="Two sentences on why your offer is relevant"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Call to action</label>
                <Textarea
                  value={callToAction}
                  onChange={(event) => setCallToAction(event.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={handleGenerateDrafts}
                disabled={generatingDrafts || sheetLeads.length === 0}
              >
                {generatingDrafts ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate drafts with Gemini'}
              </Button>
              {sendingMode === 'bulk' && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={sendBulkEmails}
                  disabled={sendingEmails || outreachUnavailable || Object.keys(drafts).length === 0}
                >
                  {sendingEmails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send bulk emails
                </Button>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-left">
                    <th className="px-4 py-2 font-mono font-semibold">Lead</th>
                    <th className="px-4 py-2 font-mono font-semibold">Company</th>
                    <th className="px-4 py-2 font-mono font-semibold">Email</th>
                    <th className="px-4 py-2 font-mono font-semibold">Status</th>
                    <th className="px-4 py-2 font-mono font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        {sheetLeads.length === 0 ? 'Load a Google Sheet to display leads.' : 'No leads match your search.'}
                      </td>
                    </tr>
                  ) : filteredLeads.map((lead) => {
                    const draft = drafts[lead.email]
                    return (
                      <tr key={lead.rowIndex} className="border-t border-border">
                        <td className="px-4 py-2">
                          <div className="font-medium">{lead.firstName || lead.lastName ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() : lead.email}</div>
                          {lead.summary && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{lead.summary}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{lead.company || '—'}</td>
                        <td className="px-4 py-2 font-mono text-xs">{lead.email}</td>
                        <td className="px-4 py-2">
                          <Badge variant={draft ? statusVariant(draft.status) : 'outline'}>
                            {draft ? draft.status.toUpperCase() : 'PENDING' }
                          </Badge>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!draft}
                              onClick={() => setPreviewEmail(lead.email)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            {sendingMode === 'single' && (
                              <Button
                                size="sm"
                                onClick={() => sendSingleEmail(lead.email)}
                                disabled={!draft || draft.status === 'queued' || draft.status === 'sent' || outreachUnavailable || sendingEmails}
                              >
                                {sendingEmails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Send
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Dialog open={Boolean(previewEmail && outreachDraft)} onOpenChange={(open) => !open && setPreviewEmail(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Email preview</DialogTitle>
                </DialogHeader>
                {previewLead && outreachDraft && (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Sending to <span className="font-medium text-foreground">{previewLead.email}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="font-mono text-sm font-semibold">Subject</div>
                      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">{outreachDraft.subject}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="font-mono text-sm font-semibold">Body</div>
                      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm whitespace-pre-line" dangerouslySetInnerHTML={{ __html: outreachDraft.body }} />
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </CardContent>
        )}
      </Card>

    </div>
  )
}

function parseSheet(sheet: SpreadsheetData): SheetLead[] {
  const rows = sheet.data || []
  if (rows.length < 2) return []
  const headerRow = rows[0]?.map((cell) => cell?.toString().trim().toLowerCase()) ?? []
  const indexFor = (key: string) => headerRow.findIndex((value) => value === key.toLowerCase())

  const emailIndex = findEmailIndex(headerRow)
  const firstNameIndex = indexFor('first name')
  const lastNameIndex = indexFor('last name')
  const companyIndex = indexFor('company')
  const summaryIndex = indexFor('summary')
  const roleIndex = indexFor('job title')

  const leads: SheetLead[] = []

  rows.slice(1).forEach((row, offset) => {
    const email = row[emailIndex]?.toString().trim().toLowerCase()
    if (!email) return
    if (!email.includes('@')) return

    leads.push({
      rowIndex: offset + 1,
      email,
      firstName: firstNameIndex >= 0 ? row[firstNameIndex]?.toString().trim() : undefined,
      lastName: lastNameIndex >= 0 ? row[lastNameIndex]?.toString().trim() : undefined,
      company: companyIndex >= 0 ? row[companyIndex]?.toString().trim() : undefined,
      summary: summaryIndex >= 0 ? row[summaryIndex]?.toString().trim() : undefined,
      role: roleIndex >= 0 ? row[roleIndex]?.toString().trim() : undefined,
    })
  })

  return leads
}

function findEmailIndex(headers: string[]): number {
  const normalizedColumns = LEAD_SHEET_COLUMNS.map((col) => col.toLowerCase())
  const emailVariants = new Set(['email', 'email address', 'e-mail'])
  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i]
    if (!header) continue
    if (emailVariants.has(header)) return i
    if (normalizedColumns[0] === header) return i
  }
  return 0
}

function statusVariant(status: DraftStatus): "default" | "outline" | "positive" | "destructive" | "neutral" {
  switch (status) {
    case 'queued':
      return 'neutral'
    case 'sent':
      return 'positive'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

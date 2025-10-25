"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import axios, { CancelTokenSource } from "axios"
import { useQuery } from "@tanstack/react-query"
import { Search, Send, Eye, RefreshCw, Download, PencilLine, X, UploadCloud } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { ErrorAlert } from "@/components/google-sheet/ErrorAlert"

import { useGoogleSheets } from "@/hooks/useGoogleSheet"
import { useGmail } from "@/hooks/useGmail"
import {
  DraftRecord,
  ManualOutreachSource,
  OutreachedJob,
  OutreachMode,
  SheetLead,
} from "@/types/outreach"
import { SpreadsheetData } from "@/types/google-sheet"
import { jobStatusVariant, parseSheet, statusVariant } from "@/lib/leads/outreach"
import { formatEmailBody } from "@/lib/email/format"
import { cn } from "@/lib/utils"
import { FastSpinner } from "./components/FastSpinner"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  status?: "loading" | "error" | "success"
}

type WizardStep = 1 | 2 | 3

type OutreachSourceType = "google-sheet" | "file-upload"

const SOURCE_OPTIONS: Array<{ value: OutreachSourceType; label: string; description: string }> = [
  {
    value: "google-sheet",
    label: "Google Sheet",
    description: "Use a connected Google Sheet. We’ll fetch the latest rows each time you launch outreach.",
  },
  {
    value: "file-upload",
    label: "Upload file",
    description: "Upload a CSV or Excel file. We’ll extract emails, names, titles, and companies automatically.",
  },
]

const htmlToPlainText = (html: string): string =>
  html
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

type PersistedWorkflowState = {
  campaignName: string
  manualCampaignId: string | null
  sourceType: OutreachSourceType | null
  currentStep: WizardStep
  selectedSheetId: string
  sheetRange: string
  leads: SheetLead[]
  promptInput: string
  chatMessages: ChatMessage[]
  drafts: Record<string, DraftRecord>
  sendingMode: OutreachMode
  uploadedFileMeta: { name: string; importedAt: number; rowCount: number } | null
  lastUpdated: number
}

const LOCAL_STORAGE_KEY = "outbond.dashboard.outreach"

type ManualCampaignGroup = {
  id: string
  name: string
  source: ManualOutreachSource | null
  sentCount: number
  totalCount: number
  lastSentAt: string | null
  jobs: OutreachedJob[]
}

const generateManualCampaignId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `outreach-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState("")
  const [sendingMode, setSendingMode] = useState<OutreachMode>("single")
  const [selectedSheetId, setSelectedSheetId] = useState<string>("")
  const [sheetRange, setSheetRange] = useState("")
  const [leads, setLeads] = useState<SheetLead[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftRecord>>({})
  const [promptInput, setPromptInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isGeneratingFromPrompt, setIsGeneratingFromPrompt] = useState(false)
  const [sendingEmails, setSendingEmails] = useState(false)
  const [sendingLeadEmail, setSendingLeadEmail] = useState<string | null>(null)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)

  const [campaignName, setCampaignName] = useState("")
  const [manualCampaignId, setManualCampaignId] = useState<string | null>(null)
  const [sourceType, setSourceType] = useState<OutreachSourceType | null>(null)
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [importingLeads, setImportingLeads] = useState(false)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [uploadedFileMeta, setUploadedFileMeta] = useState<{ name: string; importedAt: number; rowCount: number } | null>(null)
  const [resumeReady, setResumeReady] = useState(false)

  const [previewEmail, setPreviewEmail] = useState<string | null>(null)
  const [previewJob, setPreviewJob] = useState<OutreachedJob | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<ManualCampaignGroup | null>(null)
  const [previewEditing, setPreviewEditing] = useState(false)
  const [editedSubject, setEditedSubject] = useState("")
  const [editedBody, setEditedBody] = useState("")

  const generateCancelSourceRef = useRef<CancelTokenSource | null>(null)
  const sendCancelSourceRef = useRef<CancelTokenSource | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const {
    data: outreachedJobsData,
    isLoading: jobsInitialLoading,
    isFetching: jobsFetching,
    refetch: refetchOutreachJobs,
    error: outreachJobsError,
  } = useQuery<OutreachedJob[], Error>({
    queryKey: ["outreachJobs"],
    queryFn: async () => {
      const response = await axios.get<{ jobs: OutreachedJob[] }>("/api/email/outreach/jobs")
      return response.data.jobs ?? []
    },
    staleTime: 1000 * 60,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (outreachJobsError) {
      toast.error("Failed to load outreached emails")
    }
  }, [outreachJobsError])

  const outreachedJobs: OutreachedJob[] = outreachedJobsData ?? []
  const jobsLoading = jobsInitialLoading || jobsFetching

  const createCancelSource = useCallback((holder: { current: CancelTokenSource | null }, reason = 'Cancelled due to a new request') => {
    if (holder.current) {
      holder.current.cancel(reason)
    }
    const nextSource = axios.CancelToken.source()
    holder.current = nextSource
    return nextSource
  }, [])

  const hasHydratedRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined" || hasHydratedRef.current) {
      return
    }
    hasHydratedRef.current = true

    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY)
      if (!stored) {
        setResumeReady(true)
        return
      }
      const parsed = JSON.parse(stored) as Partial<PersistedWorkflowState> | null
      if (!parsed) {
        setResumeReady(true)
        return
      }

      setCampaignName(parsed.campaignName ?? "")
      setManualCampaignId(parsed.manualCampaignId ?? null)
      setSourceType(parsed.sourceType ?? null)
      setCurrentStep((parsed.currentStep ?? 1) as WizardStep)
      setSelectedSheetId(parsed.selectedSheetId ?? "")
      setSheetRange(parsed.sheetRange ?? "")
      setLeads(Array.isArray(parsed.leads) ? parsed.leads : [])
      setPromptInput(parsed.promptInput ?? "")
      setChatMessages(Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [])
      setDrafts(parsed.drafts ?? {})
      setSendingMode(parsed.sendingMode ?? "single")
      setUploadedFileMeta(parsed.uploadedFileMeta ?? null)
    } catch (error) {
      console.error("Failed to restore outreach workflow:", error)
      toast.error("We couldn't resume your last outreach session. Starting fresh.")
      window.localStorage.removeItem(LOCAL_STORAGE_KEY)
    } finally {
      setResumeReady(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!resumeReady || typeof window === "undefined") {
      return
    }
    const payload: PersistedWorkflowState = {
      campaignName,
      manualCampaignId,
      sourceType,
      currentStep,
      selectedSheetId,
      sheetRange,
      leads,
      promptInput,
      chatMessages,
      drafts,
      sendingMode,
      uploadedFileMeta,
      lastUpdated: Date.now(),
    }
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.error("Failed to persist outreach workflow:", error)
    }
  }, [
    campaignName,
    manualCampaignId,
    sourceType,
    currentStep,
    selectedSheetId,
    sheetRange,
    leads,
    promptInput,
    chatMessages,
    drafts,
    sendingMode,
    uploadedFileMeta,
    resumeReady,
  ])

  const handleFileUpload = useCallback(
    async (file: File) => {
      setImportingLeads(true)
      setSourceError(null)
      setLeads([])
      setDrafts({})
      setChatMessages([])
      setPromptInput("")
      try {
        const arrayBuffer = await file.arrayBuffer()
        const XLSX = await import("xlsx")
        const workbook = XLSX.read(arrayBuffer, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          throw new Error("No sheets were found in that file.")
        }
        const worksheet = workbook.Sheets[sheetName]
        if (!worksheet) {
          throw new Error("Unable to read the first sheet in that file.")
        }
        const rawRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
          header: 1,
          blankrows: false,
          defval: "",
        })
        const normalizedRows = rawRows.map((row) =>
          Array.isArray(row) ? row.map((value) => value?.toString().trim() ?? "") : [],
        )
        if (normalizedRows.length === 0) {
          throw new Error("The uploaded file is empty.")
        }
        const spreadsheetData: SpreadsheetData = {
          spreadsheet: {
            properties: { title: file.name },
            sheets: [
              {
                properties: {
                  sheetId: 0,
                  title: sheetName,
                },
              },
            ],
          },
          data: normalizedRows as string[][],
          sheets: [{ id: 0, title: sheetName }],
        }
        const parsedLeads = parseSheet(spreadsheetData)
        if (!parsedLeads.length) {
          throw new Error("We couldn't find any leads with email addresses in that file.")
        }
        setLeads(
          parsedLeads.map((lead, index) => ({
            ...lead,
            sourceRowRef: lead.sourceRowRef ?? String(index + 2),
          })),
        )
        setUploadedFileMeta({
          name: file.name,
          importedAt: Date.now(),
          rowCount: parsedLeads.length,
        })
        toast.success(`Loaded ${parsedLeads.length} leads from ${file.name}`)
      } catch (error) {
        console.error("Upload parse error:", error)
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Failed to read the uploaded file. Make sure it includes a header row with an Email column."
        setSourceError(message)
        toast.error(message)
        setUploadedFileMeta(null)
      } finally {
        setImportingLeads(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    },
    [],
  )

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      void handleFileUpload(file)
    },
    [handleFileUpload],
  )

  const handleSourceTypeChange = useCallback(
    (next: OutreachSourceType) => {
      setSourceType((previous) => {
        if (previous === next) {
          return previous
        }
        return next
      })
      generateCancelSourceRef.current?.cancel("Source changed")
      setLeads([])
      setDrafts({})
      setChatMessages([])
      setPromptInput("")
      setSourceError(null)
      setUploadedFileMeta(null)
      setSheetsError(null)
      if (next !== "google-sheet") {
        setSelectedSheetId("")
        setSheetRange("")
      }
    },
    [],
  )

  const setStep = useCallback((next: WizardStep) => {
    setCurrentStep(() => {
      if (next < 1) return 1
      if (next > 3) return 3
      return next
    })
  }, [])

  const hasLeads = leads.length > 0
  const hasDrafts = Object.keys(drafts).length > 0

  const handleStep1Continue = useCallback(() => {
    const trimmedName = campaignName.trim()
    if (!trimmedName) {
      setSourceError('Give this outreach a name before continuing.')
      return
    }
    if (!sourceType) {
      setSourceError('Choose where your leads should come from.')
      return
    }
    if (leads.length === 0) {
      setSourceError('Load leads before moving to the next step.')
      return
    }
    if (!manualCampaignId) {
      setManualCampaignId(generateManualCampaignId())
    }
    setCampaignName(trimmedName)
    setSourceError(null)
    setStep(2)
  }, [campaignName, sourceType, leads.length, manualCampaignId, setStep])

  const handleStep2Continue = useCallback(() => {
    if (!hasDrafts) {
      setSourceError('Generate drafts for your leads before reviewing them.')
      return
    }
    setSourceError(null)
    setStep(3)
  }, [hasDrafts, setStep])

  useEffect(() => {
    return () => {
      generateCancelSourceRef.current?.cancel('Component unmounted')
      sendCancelSourceRef.current?.cancel('Component unmounted')
    }
  }, [])

  const {
    spreadsheets,
    selectedSheet,
    hasFetchedSpreadsheets,
    loading: sheetsLoading,
    error: sheetsError,
    setError: setSheetsError,
    checkConnectionStatus,
    fetchSpreadsheets,
    fetchSheetData,
  } = useGoogleSheets()

  const { status: gmailStatus } = useGmail()

  useEffect(() => {
    checkConnectionStatus().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (sourceType !== "google-sheet") return
    if (selectedSheetId) return
    if (spreadsheets.length > 0) {
      setSelectedSheetId(spreadsheets[0].id)
    }
  }, [selectedSheetId, sourceType, spreadsheets])

  useEffect(() => {
    if (sourceType !== "google-sheet") {
      return
    }
    if (!selectedSheet) {
      setLeads([])
      setDrafts({})
      setChatMessages([])
      setPromptInput("")
      return
    }
    const leads = parseSheet(selectedSheet)
    setLeads(leads)
    setDrafts({})
    setChatMessages([])
    setPromptInput("")
    setSheetsError(null)
  }, [selectedSheet, setSheetsError, sourceType])

  useEffect(() => {
    if (!previewEmail) {
      setPreviewEditing(false)
      return
    }
    const draft = drafts[previewEmail]
    if (!draft) {
      setPreviewEditing(false)
      return
    }
    setEditedSubject(draft.subject)
    setEditedBody(draft.bodyText || "")
    setPreviewEditing(false)
  }, [previewEmail, drafts])

  const filteredLeads = leads.filter((lead) => {
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

  const { manualCampaigns, legacyJobs } = useMemo(() => {
    const map = new Map<string, ManualCampaignGroup>()
    const legacy: OutreachedJob[] = []
    outreachedJobs.forEach((job) => {
      if (job.manualCampaignId) {
        const id = job.manualCampaignId
        const lastTimestamp = job.sentAt ?? job.createdAt
        const status = job.status?.toUpperCase() ?? ""
        if (map.has(id)) {
          const group = map.get(id)!
          group.totalCount += 1
          if (status === "SENT") {
            group.sentCount += 1
          }
          group.jobs.push(job)
          if (!group.lastSentAt || new Date(lastTimestamp).getTime() > new Date(group.lastSentAt).getTime()) {
            group.lastSentAt = lastTimestamp
          }
          if (job.manualCampaignSource && !group.source) {
            group.source = job.manualCampaignSource
          }
          if (job.manualCampaignName) {
            group.name = job.manualCampaignName
          }
        } else {
          map.set(id, {
            id,
            name: job.manualCampaignName ?? "Untitled Outreach",
            source: job.manualCampaignSource ?? null,
            sentCount: status === "SENT" ? 1 : 0,
            totalCount: 1,
            lastSentAt: lastTimestamp,
            jobs: [job],
          })
        }
      } else {
        legacy.push(job)
      }
    })
    const campaigns = Array.from(map.values()).sort((a, b) => {
      const aTime = a.lastSentAt ? new Date(a.lastSentAt).getTime() : 0
      const bTime = b.lastSentAt ? new Date(b.lastSentAt).getTime() : 0
      return bTime - aTime
    })
    return { manualCampaigns: campaigns, legacyJobs: legacy }
  }, [outreachedJobs])

  const filteredCampaigns = useMemo(() => {
    if (!searchTerm.trim()) return manualCampaigns
    const query = searchTerm.toLowerCase()
    return manualCampaigns.filter((campaign) => {
      if (campaign.name.toLowerCase().includes(query)) {
        return true
      }
      return campaign.jobs.some((job) => {
        const fields = [
          job.leadEmail,
          job.leadFirstName ?? '',
          job.leadLastName ?? '',
          job.leadCompany ?? '',
          job.subject,
          job.manualCampaignName ?? '',
        ]
        return fields.some((value) => value?.toLowerCase().includes(query))
      })
    })
  }, [manualCampaigns, searchTerm])

  const filteredLegacyJobs = useMemo(() => {
    if (!searchTerm.trim()) return legacyJobs
    const query = searchTerm.toLowerCase()
    return legacyJobs.filter((job) => {
      const fields = [
        job.leadEmail,
        job.leadFirstName ?? '',
        job.leadLastName ?? '',
        job.leadCompany ?? '',
        job.subject,
      ]
      return fields.some((value) => value?.toLowerCase().includes(query))
    })
  }, [legacyJobs, searchTerm])

  const pendingBulkEmails = useMemo(
    () =>
      Object.entries(drafts)
        .filter(([, draft]) => draft.status === 'pending')
        .map(([email]) => email),
    [drafts],
  )
  const pendingDraftCount = pendingBulkEmails.length

  const outreachDraft = previewEmail ? drafts[previewEmail] : null
  const previewLead = useMemo(() => leads.find((lead) => lead.email === previewEmail), [previewEmail, leads])

  const handleSheetSelectOpen = useCallback((open: boolean) => {
    if (open && !hasFetchedSpreadsheets && !sheetsLoading) {
      fetchSpreadsheets().catch(() => undefined)
    }
  }, [fetchSpreadsheets, hasFetchedSpreadsheets, sheetsLoading])

  const handleExportOutreachedCsv = useCallback(
    (jobsToExport?: OutreachedJob[], options?: { fileLabel?: string }) => {
      const sourceJobs: OutreachedJob[] = jobsToExport ?? outreachedJobs
      if (!sourceJobs.length || typeof window === 'undefined') {
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

      const rows = sourceJobs.map((job): string[] => [
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
      const label = options?.fileLabel ?? (jobsToExport && jobsToExport[0]?.manualCampaignName) ?? 'outreached-emails'
      link.href = url
      link.download = `${label}-${new Date().toISOString()}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    },
    [outreachedJobs],
  )

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

  const handlePromptSubmit = async () => {
    const trimmedPrompt = promptInput.trim()
    if (!leads.length) {
      setSourceError('Load leads before generating drafts')
      setSheetsError(null)
      toast.error('Load leads first')
      return
    }
    if (!trimmedPrompt) {
      setSourceError('Add a prompt so the AI knows what to write')
      toast.error('Describe the outreach email you want before generating drafts')
      return
    }
    if (leads.length > 50) {
      const message = 'The outreach generator can handle up to 50 leads per batch. Narrow your range before continuing.'
      setSourceError(message)
      toast.error(message)
      return
    }

    const userMessageId = `user-${Date.now()}`
    const assistantMessageId = `assistant-${Date.now()}`
    setChatMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", content: trimmedPrompt },
      { id: assistantMessageId, role: "assistant", content: "Working on your request…", status: "loading" },
    ])
    setPromptInput("")
    setIsGeneratingFromPrompt(true)
    setDrafts({})
    setSourceError(null)

    let cancelSource: CancelTokenSource | null = null
    try {
      cancelSource = createCancelSource(generateCancelSourceRef)
      const response = await axios.post<{ drafts: Array<{ email: string; subject: string; bodyHtml: string; bodyText: string }> }>(
        '/api/email/outreach/draft',
        {
          leads: leads.map((lead) => ({
            email: lead.email,
            firstName: lead.firstName,
            lastName: lead.lastName,
            company: lead.company,
            summary: lead.summary,
            role: lead.role,
          })),
          sender: {
            name: gmailStatus?.emailAddress?.split('@')[0] || undefined,
            prompt: trimmedPrompt,
          },
        },
        { cancelToken: cancelSource.token },
      )

      const generated = response.data.drafts ?? []
      if (!generated.length) {
        setChatMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? { ...message, status: "error", content: "I couldn't generate any drafts. Try adjusting your prompt and run it again." }
              : message,
          ),
        )
        toast.error('No drafts were generated. Try refining your prompt.')
        return
      }

      const nextDrafts = generated.reduce<Record<string, DraftRecord>>((acc, item) => {
        if (!item.email) return acc
        acc[item.email] = {
          subject: item.subject.trim(),
          bodyHtml: item.bodyHtml,
          bodyText: item.bodyText,
          status: 'pending',
        }
        return acc
      }, {})

      setDrafts(nextDrafts)

      const missingCount = leads.length - generated.length
      const summary =
        missingCount > 0
          ? `Generated ${generated.length} drafts. ${missingCount} lead${missingCount === 1 ? '' : 's'} were skipped—check their data and try again if needed.`
          : `Generated drafts for all ${generated.length} leads.`

      setChatMessages((prev) =>
        prev.map((message) =>
          message.id === assistantMessageId
            ? { ...message, status: "success", content: summary }
            : message,
        ),
      )
      toast.success(`Prepared ${generated.length} drafts`)
    } catch (error) {
      if (axios.isCancel(error)) {
        setChatMessages((prev) => prev.filter((message) => message.id !== assistantMessageId))
        return
      }

      console.error('Draft generation error:', error)
      const message =
        axios.isAxiosError(error)
          ? (error.response?.data as { error?: string })?.error || error.message || 'Failed to generate outreach drafts'
          : 'Failed to generate outreach drafts'
      setSourceError(message)
      setChatMessages((prev) =>
        prev.map((chat) =>
          chat.id === assistantMessageId
            ? { ...chat, status: "error", content: message }
            : chat,
        ),
      )
      toast.error(message)
    } finally {
      if (cancelSource && generateCancelSourceRef.current === cancelSource) {
        generateCancelSourceRef.current = null
      }
      setIsGeneratingFromPrompt(false)
    }
  }

  const queueEmails = async (emails: string[], options: { mode?: OutreachMode } = {}) => {
    if (!emails.length) return
    const mode = options.mode ?? sendingMode
    if (mode === 'bulk') {
      setSendingEmails(true)
    } else if (mode === 'single' && emails.length === 1) {
      setSendingLeadEmail(emails[0])
    }
    let activeCampaignId = manualCampaignId
    if (!activeCampaignId) {
      activeCampaignId = generateManualCampaignId()
      setManualCampaignId(activeCampaignId)
    }
    const campaignLabel = campaignName ? campaignName.trim() : "Untitled Outreach"

    let cancelSource: CancelTokenSource | null = null
    try {
      const jobs = emails
        .map((email) => {
          const lead = leads.find((l) => l.email === email)
          const draft = drafts[email]
          if (!lead || !draft) return null
          return {
            email,
            subject: draft.subject,
            bodyHtml: draft.bodyHtml,
            bodyText: draft.bodyText,
            firstName: lead.firstName,
            lastName: lead.lastName,
            company: lead.company,
            summary: lead.summary,
            sheetRowRef: lead.sourceRowRef ?? `${lead.rowIndex}`,
            manualCampaignId: activeCampaignId,
            manualCampaignName: campaignLabel,
            manualCampaignSource: sourceType as ManualOutreachSource | null,
          }
        })
        .filter(Boolean)

      if (!jobs.length) {
        setSourceError('No drafts available for the selected leads')
        return
      }

      cancelSource = createCancelSource(sendCancelSourceRef)

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
      const successMessage = mode === 'bulk' ? 'All outreach emails were sent successfully.' : 'Email sent successfully.'
      toast.success(successMessage)
      setSourceError(null)
      await refetchOutreachJobs().catch(() => undefined)
    } catch (error) {
      if (axios.isCancel(error)) {
        return
      }
      console.error('Email queue error:', error)
      if (axios.isAxiosError(error)) {
        const message =
          (error.response?.data as { error?: string })?.error ||
          error.message ||
          'Failed to queue outreach emails'
        setSourceError(message)
        if (error.response?.status === 409) {
          toast.error(message)
        }
      } else {
        setSourceError('Failed to queue outreach emails')
      }
    } finally {
      if (cancelSource && sendCancelSourceRef.current === cancelSource) {
        sendCancelSourceRef.current = null
      }
      if (mode === 'bulk') {
        setSendingEmails(false)
      }
      if (mode === 'single') {
        setSendingLeadEmail(null)
      }
    }
  }

  const sendSingleEmail = (email: string) => {
    if (sendingMode !== 'single') return
    const draft = drafts[email]
    if (!draft || draft.status === 'sent') {
      toast.error('Generate and review the draft before sending it.')
      return
    }
    queueEmails([email], { mode: 'single' })
  }

  const handleBulkSendClick = () => {
    if (sendingMode !== 'bulk') return
    if (!pendingDraftCount) {
      toast.error('Generate drafts before sending in bulk.')
      return
    }
    setBulkDialogOpen(true)
  }

  const confirmBulkSend = () => {
    setBulkDialogOpen(false)
    if (!pendingDraftCount) return
    queueEmails(pendingBulkEmails, { mode: 'bulk' })
  }

  const startEditingPreview = () => {
    if (!previewEmail) return
    const draft = drafts[previewEmail]
    if (!draft) return
    setEditedSubject(draft.subject)
    setEditedBody(draft.bodyText || "")
    setPreviewEditing(true)
  }

  const cancelEditingPreview = () => {
    if (!previewEmail) {
      setPreviewEditing(false)
      return
    }
    const draft = drafts[previewEmail]
    setEditedSubject(draft?.subject ?? "")
    setEditedBody(draft?.bodyText ?? "")
    setPreviewEditing(false)
  }

  const saveEditedPreview = () => {
    if (!previewEmail) return
    const subject = editedSubject.trim()
    const body = editedBody.trim()
    if (!subject || !body) {
      toast.error('Subject and body cannot be empty.')
      return
    }

    const { html, text } = formatEmailBody(body)

    setDrafts((prev) => {
      const draft = prev[previewEmail]
      if (!draft) return prev
      return {
        ...prev,
        [previewEmail]: {
          ...draft,
          subject,
          bodyHtml: html,
          bodyText: text,
        },
      }
    })

    setPreviewEditing(false)
    toast.success('Draft updated')
  }

  const outreachUnavailable = !gmailStatus?.isConnected
  const step1Complete = hasLeads
  const step2Complete = hasDrafts

  useEffect(() => {
    if (!resumeReady) return
    if (!step1Complete && currentStep > 1) {
      setCurrentStep(1)
    } else if (!step2Complete && currentStep > 2) {
      setCurrentStep(2)
    }
  }, [currentStep, resumeReady, step1Complete, step2Complete])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-mono font-bold text-foreground">Leads</h1>
        <p className="text-muted-foreground">Import, enrich, and engage your outbound database</p>
      </div>

      <Card className="space-y-0">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads, campaigns, and outreached emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setWizardOpen(true)
                setStep(1)
              }}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              Outreach leads
            </Button>
          </div>
      </CardContent>
    </Card>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{campaignName ? campaignName : "Launch outreach campaign"}</DialogTitle>
            <DialogDescription>
              Step {currentStep} of 3
              {sourceType ? ` · ${sourceType === "google-sheet" ? "Google Sheet" : "File upload"}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {currentStep === 1 ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground" htmlFor="outreach-campaign-name">
                    Campaign name
                  </label>
                  <Input
                    id="outreach-campaign-name"
                    value={campaignName}
                    onChange={(event) => setCampaignName(event.target.value)}
                    placeholder="Ex: HR Directors – Feb 2025"
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Lead source</p>
                  <div className="space-y-2">
                    {SOURCE_OPTIONS.map((option) => {
                      const isActive = sourceType === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleSourceTypeChange(option.value)}
                          className={cn(
                            "w-full rounded-lg border p-4 text-left transition",
                            isActive
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40 hover:bg-muted/50",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-foreground">{option.label}</span>
                            {isActive ? <Badge variant="positive">Selected</Badge> : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {sourceType === "google-sheet" ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Google Sheet</label>
                        <Select
                          value={selectedSheetId}
                          onValueChange={(value) => {
                            setSelectedSheetId(value)
                            setSheetRange("")
                          }}
                          onOpenChange={handleSheetSelectOpen}
                          disabled={spreadsheets.length === 0 && sheetsLoading}
                        >
                          <SelectTrigger className="w-full justify-between">
                            <SelectValue
                              placeholder={
                                spreadsheets.length
                                  ? "Select sheet"
                                  : sheetsLoading
                                    ? "Loading sheets…"
                                    : "No sheets saved"
                              }
                            />
                            {sheetsLoading ? <FastSpinner size="sm" /> : null}
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
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" onClick={handleLoadSheet} disabled={sheetsLoading || !selectedSheetId}>
                            {sheetsLoading ? <FastSpinner size="sm" className="mr-2" /> : null}
                            Load data
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fetchSpreadsheets().catch(() => undefined)}
                            disabled={sheetsLoading}
                          >
                            Refresh library
                          </Button>
                        </div>
                      </div>
                    </div>
                    {sheetsError ? <ErrorAlert error={sheetsError} onClose={() => setSheetsError(null)} /> : null}
                    {hasLeads ? (
                      <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                        Loaded {leads.length} leads from the selected sheet.
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {sourceType === "file-upload" ? (
                  <div className="space-y-4">
                    <label
                      htmlFor="manual-outreach-upload"
                      className={cn(
                        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-background p-8 text-center transition hover:border-primary/40 hover:bg-muted/40",
                        importingLeads ? "border-primary bg-primary/5" : "",
                      )}
                    >
                      {importingLeads ? <FastSpinner size="lg" /> : <UploadCloud className="h-8 w-8 text-muted-foreground" />}
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Upload a CSV or Excel file</p>
                        <p className="text-xs text-muted-foreground">
                          We’ll detect emails, first names, last names, job titles, and companies automatically.
                        </p>
                      </div>
                      <span className="text-xs font-medium text-primary">Click to browse files</span>
                    </label>
                    <input
                      ref={fileInputRef}
                      id="manual-outreach-upload"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />
                    {uploadedFileMeta ? (
                      <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                        Loaded {uploadedFileMeta.rowCount} leads from {uploadedFileMeta.name} ·{" "}
                        {new Date(uploadedFileMeta.importedAt).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {sourceError ? <p className="text-sm text-destructive">{sourceError}</p> : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="outline" onClick={() => setWizardOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleStep1Continue}
                    disabled={!campaignName.trim() || !sourceType || leads.length === 0}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono uppercase">
                    Step 2
                  </Badge>
                  <h3 className="text-base font-semibold text-foreground">Describe the outreach email</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Share the angle, tone, and CTA you’d like. The AI follows your prompt when drafting emails for every lead.
                </p>
                <div className="rounded-lg border border-border bg-background p-4">
                  {chatMessages.length === 0 ? (
                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                      Your conversation with the AI will appear here once you send a prompt.
                    </div>
                  ) : (
                    <div className="flex max-h-72 flex-col gap-4 overflow-y-auto">
                      {chatMessages.map((message) => {
                        const isUser = message.role === "user"
                        const isError = message.status === "error"
                        const bubbleClass = cn(
                          "max-w-[75%] rounded-lg px-4 py-3 text-sm shadow-sm",
                          isUser ? "text-black" : "bg-muted/60 text-foreground",
                          isError ? "bg-red-100 text-red-900" : "",
                        )

                        return (
                          <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                            <div
                              className={bubbleClass}
                              style={isUser && !isError ? { backgroundColor: "hsl(var(--cwt-plum))" } : undefined}
                            >
                              {message.status === "loading" ? (
                                <div className="flex items-center gap-2">
                                  <FastSpinner size="sm" />
                                  <span>{message.content}</span>
                                </div>
                              ) : (
                                <span>{message.content}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!isGeneratingFromPrompt) {
                      void handlePromptSubmit()
                    }
                  }}
                >
                  <Textarea
                    value={promptInput}
                    onChange={(event) => setPromptInput(event.target.value)}
                    placeholder="Example: Reference their Series B, mention how we halve onboarding time, and close with a discovery call offer."
                    rows={4}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      Mention tone, proof points, objections to overcome, and the closing CTA you expect.
                    </p>
                    <Button type="submit" disabled={isGeneratingFromPrompt}>
                      {isGeneratingFromPrompt ? (
                        <>
                          <FastSpinner size="sm" className="mr-2" />
                          Generating drafts…
                        </>
                      ) : (
                        "Generate drafts"
                      )}
                    </Button>
                  </div>
                </form>
                {sourceError ? <p className="text-sm text-destructive">{sourceError}</p> : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    Previous
                  </Button>
                  <Button type="button" onClick={handleStep2Continue} disabled={!hasDrafts}>
                    Next
                  </Button>
                </div>
              </div>
            ) : null}

            {currentStep === 3 ? (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono uppercase">
                    Step 3
                  </Badge>
                  <h3 className="text-base font-semibold text-foreground">Review & send</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Preview every message before delivery. Switch between single send or a bulk blast when you’re ready.
                </p>
                {sourceError ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {sourceError}
                  </div>
                ) : null}
                <div className="overflow-x-auto rounded-lg border border-border">
                  {hasDrafts ? (
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
                              {leads.length === 0 ? "Load leads to display results." : "No leads match your search."}
                            </td>
                          </tr>
                        ) : (
                          filteredLeads.map((lead) => {
                            const draft = drafts[lead.email]
                            const isSendingThisLead = sendingLeadEmail === lead.email
                            const isAnotherLeadSending = sendingLeadEmail !== null && !isSendingThisLead
                            return (
                              <tr key={lead.rowIndex} className="border-t border-border">
                                <td className="px-4 py-2">
                                  <div className="font-medium">
                                    {lead.firstName || lead.lastName
                                      ? `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim()
                                      : lead.email}
                                  </div>
                                  {lead.summary && (
                                    <div className="text-xs text-muted-foreground line-clamp-1">{lead.summary}</div>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-muted-foreground">{lead.company || "—"}</td>
                                <td className="px-4 py-2 font-mono text-xs">{lead.email}</td>
                                <td className="px-4 py-2">
                                  <Badge variant={draft ? statusVariant(draft.status) : "outline"}>
                                    {draft ? draft.status.toUpperCase() : "WAITING"}
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
                                      <Eye className="mr-2 h-4 w-4" />
                                      View
                                    </Button>
                                    {sendingMode === "single" && (
                                      <Button
                                        size="sm"
                                        onClick={() => sendSingleEmail(lead.email)}
                                        disabled={
                                          !draft ||
                                          draft.status === "queued" ||
                                          draft.status === "sent" ||
                                          outreachUnavailable ||
                                          isSendingThisLead ||
                                          isAnotherLeadSending
                                        }
                                      >
                                        {isSendingThisLead ? (
                                          <FastSpinner size="sm" className="mr-2" />
                                        ) : (
                                          <Send className="mr-2 h-4 w-4" />
                                        )}
                                        Send
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                      <FastSpinner />
                      {isGeneratingFromPrompt ? "Generating drafts…" : "Generate drafts to preview outreach emails."}
                    </div>
                  )}
                </div>

                {hasDrafts ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">How would you like to send these emails?</p>
                      <p className="text-xs text-muted-foreground">Switch between single send or bulk delivery.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={sendingMode === "single" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSendingMode("single")}
                      >
                        Single send
                      </Button>
                      <Button
                        type="button"
                        variant={sendingMode === "bulk" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSendingMode("bulk")}
                      >
                        Bulk send
                      </Button>
                    </div>

                    {sendingMode === "bulk" ? (
                      <>
                        <Button
                          type="button"
                          onClick={handleBulkSendClick}
                          disabled={sendingEmails || outreachUnavailable || !pendingDraftCount}
                          className="flex w-full justify-center sm:w-auto"
                        >
                          {sendingEmails ? <FastSpinner size="sm" className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
                          Send {pendingDraftCount} emails
                        </Button>

                        <AlertDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Send {pendingDraftCount} emails in bulk?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Make sure you’ve reviewed each draft — AI can make mistakes. All emails will be queued immediately.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={sendingEmails}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={confirmBulkSend} disabled={sendingEmails}>
                                {sendingEmails ? <FastSpinner size="sm" className="mr-2" /> : null}
                                Send all
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Use the send button inside the table once you’ve reviewed the draft.
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>
                    Previous
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setWizardOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>


      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-mono">Outreach history</CardTitle>
            <p className="text-sm text-muted-foreground">
              Review sent campaigns and legacy emails queued from this dashboard.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => refetchOutreachJobs().catch(() => undefined)}
              disabled={jobsLoading}
            >
              {jobsLoading ? <FastSpinner size="sm" className="mr-2" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {jobsLoading ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleExportOutreachedCsv(undefined, { fileLabel: "outreached-emails" })}
              disabled={!outreachedJobs.length || jobsLoading}
            >
              <Download className="mr-2 h-4 w-4" />
              Export all
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Completed outreach campaigns</h3>
                <p className="text-xs text-muted-foreground">
                  Click any campaign to review the leads that were emailed. Campaign summaries include only outreach launched from this page.
                </p>
              </div>
              <Badge variant="outline" className="font-mono uppercase">
                {manualCampaigns.length} total
              </Badge>
            </div>
            {jobsLoading ? (
              <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                <FastSpinner />
                Loading outreach history…
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
                {manualCampaigns.length === 0
                  ? "No outreach campaigns have been sent yet. Complete Step 3 above to start building your history."
                  : "No campaigns match your search."}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{campaign.name}</span>
                        <Badge variant="outline" className="font-mono text-xs uppercase">
                          {campaign.sentCount}/{campaign.totalCount} sent
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {campaign.source === "google-sheet" ? "Google Sheet" : "File upload"} • {campaign.lastSentAt ? new Date(campaign.lastSentAt).toLocaleString() : "Not sent yet"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedCampaign(campaign)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View leads
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleExportOutreachedCsv(campaign.jobs, {
                            fileLabel: campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                          })
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Legacy emails</h3>
                <p className="text-xs text-muted-foreground">
                  Emails without a campaign tag appear here. You can still review and export them.
                </p>
              </div>
              <Badge variant="outline" className="font-mono uppercase">
                {filteredLegacyJobs.length}
              </Badge>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-left">
                    <th className="px-4 py-2 font-mono font-semibold">Recipient</th>
                    <th className="px-4 py-2 font-mono font-semibold">Subject</th>
                    <th className="px-4 py-2 font-mono font-semibold">Status</th>
                    <th className="px-4 py-2 font-mono font-semibold">Sent</th>
                    <th className="px-4 py-2 font-mono font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobsLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        Loading outreached emails…
                      </td>
                    </tr>
                  ) : filteredLegacyJobs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        {legacyJobs.length === 0 ? "No emails have been sent yet." : "No legacy emails match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredLegacyJobs.map((job: OutreachedJob) => (
                      <tr key={job.id} className="border-t border-border">
                        <td className="px-4 py-2">
                          <div className="font-medium">
                            {job.leadFirstName || job.leadLastName
                              ? `${job.leadFirstName ?? ""} ${job.leadLastName ?? ""}`.trim()
                              : job.leadEmail}
                          </div>
                          <div className="text-xs text-muted-foreground">{job.leadEmail}</div>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground line-clamp-1">{job.subject}</td>
                        <td className="px-4 py-2">
                          <Badge variant={jobStatusVariant(job.status)}>
                            {job.status === "SENT" ? "COMPLETED" : job.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-xs whitespace-nowrap text-muted-foreground">
                          {job.sentAt ? new Date(job.sentAt).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <Button size="sm" variant="outline" onClick={() => setPreviewJob(job)}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </CardContent>
      </Card>

      <Dialog open={Boolean(previewJob)} onOpenChange={(open) => !open && setPreviewJob(null)}>
        <DialogContent className="w-full max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sent email</DialogTitle>
          </DialogHeader>
          {previewJob && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Sent to <span className="font-medium text-foreground">{previewJob.leadEmail}</span>
              </div>
              <div className="space-y-2">
                <div className="font-mono text-sm font-semibold">Subject</div>
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">{previewJob.subject}</div>
              </div>
              <div className="space-y-2">
                <div className="font-mono text-sm font-semibold">Body</div>
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                  {previewJob.bodyText ? previewJob.bodyText : htmlToPlainText(previewJob.bodyHtml)}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedCampaign)} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
        <DialogContent className="w-full max-w-4xl overflow-hidden p-0">
          <DialogHeader className="space-y-2 px-6 pt-6">
            <DialogTitle>{selectedCampaign?.name ?? "Outreach campaign"}</DialogTitle>
            <DialogDescription>
              {selectedCampaign
                ? `${selectedCampaign.sentCount}/${selectedCampaign.totalCount} emails sent · ${selectedCampaign.source === "google-sheet" ? "Google Sheet" : "File upload"}`
                : null}
            </DialogDescription>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-4 px-6 pb-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Last activity {selectedCampaign.lastSentAt ? new Date(selectedCampaign.lastSentAt).toLocaleString() : "Not sent yet"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleExportOutreachedCsv(selectedCampaign.jobs, {
                      fileLabel: selectedCampaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                    })
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-[720px] w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-left">
                      <th className="px-4 py-2 font-mono font-semibold">Recipient</th>
                      <th className="px-4 py-2 font-mono font-semibold">Subject</th>
                      <th className="px-4 py-2 font-mono font-semibold">Status</th>
                      <th className="px-4 py-2 font-mono font-semibold">Sent</th>
                      <th className="px-4 py-2 font-mono font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCampaign.jobs.map((job: OutreachedJob) => (
                      <tr key={job.id} className="border-t border-border">
                        <td className="px-4 py-2">
                          <div className="font-medium">
                            {job.leadFirstName || job.leadLastName
                              ? `${job.leadFirstName ?? ""} ${job.leadLastName ?? ""}`.trim()
                              : job.leadEmail}
                          </div>
                          <div className="text-xs text-muted-foreground">{job.leadEmail}</div>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground line-clamp-1">{job.subject}</td>
                        <td className="px-4 py-2">
                          <Badge variant={jobStatusVariant(job.status)}>
                            {job.status === "SENT" ? "COMPLETED" : job.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-xs whitespace-nowrap text-muted-foreground">
                          {job.sentAt ? new Date(job.sentAt).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <Button size="sm" variant="outline" onClick={() => setPreviewJob(job)}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}

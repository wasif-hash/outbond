"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import axios, { CancelTokenSource } from "axios"
import { useQuery } from "@tanstack/react-query"
import { Search, UploadCloud } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { parseSheet } from "@/lib/leads/outreach"
import { formatEmailBody } from "@/lib/email/format"
import { DraftPreviewPanel } from "./components/draft-preview-panel"
import { WizardOverlay } from "./components/wizard-overlay"
import type { StepOneProps, StepTwoProps, StepThreeProps, WizardOverlayProps } from "./components/wizard-overlay"
import { SentEmailPanel } from "./components/sent-email-panel"
import { SentCampaignPanel } from "./components/sent-campaign-panel"
import { OutreachHistory } from "./components/outreach-history"
import type { ChatMessage, ManualCampaignGroup, OutreachSourceType, PersistedWorkflowState, WizardStep } from "./components/types"

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

const LOCAL_STORAGE_KEY = "outbond.dashboard.outreach"

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

  const outreachedJobs = useMemo<OutreachedJob[]>(() => outreachedJobsData ?? [], [outreachedJobsData])

  const {
    spreadsheets,
    selectedSheet,
    hasFetchedSpreadsheets,
    loading: sheetsLoading,
    error: sheetsError,
    setError: setSheetsError,
    fetchSpreadsheets,
    fetchSheetData,
  } = useGoogleSheets()
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
    [setSheetsError],
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

  const { status: gmailStatus } = useGmail()

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

  const handleSheetSelectOpen = useCallback(
    (open: boolean) => {
      if (!open || sheetsLoading) {
        return
      }
      if (!hasFetchedSpreadsheets || spreadsheets.length === 0) {
        void fetchSpreadsheets({ force: !hasFetchedSpreadsheets })
      }
    },
    [fetchSpreadsheets, hasFetchedSpreadsheets, sheetsLoading, spreadsheets.length],
  )

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

  const outreachUnavailable = gmailStatus ? !gmailStatus.isConnected : false
  const step1Complete = hasLeads
  const step2Complete = hasDrafts

  const handleCloseDraftPreview = useCallback(() => {
    setPreviewEmail(null)
    setPreviewEditing(false)
  }, [])

  const handleCloseWizard = useCallback(() => {
    setSourceError(null)
    setWizardOpen(false)
  }, [])
  useEffect(() => {
    if (!resumeReady) return
    if (!step1Complete && currentStep > 1) {
      setCurrentStep(1)
    } else if (!step2Complete && currentStep > 2) {
      setCurrentStep(2)
    }
  }, [currentStep, resumeReady, step1Complete, step2Complete])

  const wizardStepOne: StepOneProps = {
    campaignName,
    onCampaignNameChange: setCampaignName,
    sourceOptions: SOURCE_OPTIONS,
    sourceType,
    onSourceTypeChange: handleSourceTypeChange,
    spreadsheets,
    selectedSheetId,
    onSelectedSheetIdChange: setSelectedSheetId,
    sheetRange,
    onSheetRangeChange: setSheetRange,
    onSheetSelectOpen: handleSheetSelectOpen,
    onLoadSheet: handleLoadSheet,
    onRefreshSheets: () => {
      void fetchSpreadsheets({ force: true })
    },
    sheetsLoading,
    sheetsError,
    onClearSheetsError: () => setSheetsError(null),
    hasLeads,
    leadsCount: leads.length,
    importingLeads,
    fileInputRef,
    onFileInputChange: handleFileInputChange,
    uploadedFileMeta,
    canProceed: Boolean(campaignName.trim() && sourceType && leads.length > 0),
    onNext: handleStep1Continue,
    onCancel: handleCloseWizard,
  }

  const wizardStepTwo: StepTwoProps = {
    chatMessages,
    promptInput,
    onPromptInputChange: setPromptInput,
    onPromptSubmit: () => {
      if (!isGeneratingFromPrompt) {
        void handlePromptSubmit()
      }
    },
    isGeneratingFromPrompt,
    hasDrafts,
    onPrevious: () => {
      setSourceError(null)
      setStep(1)
    },
    onNext: handleStep2Continue,
  }

  const wizardStepThree: StepThreeProps = {
    filteredLeads,
    leads,
    drafts,
    sendingMode,
    onSendingModeChange: setSendingMode,
    sendSingleEmail,
    sendingLeadEmail,
    sendingEmails,
    outreachUnavailable,
    hasDrafts,
    pendingDraftCount,
    onBulkSendClick: handleBulkSendClick,
    bulkDialogOpen,
    onBulkDialogChange: setBulkDialogOpen,
    confirmBulkSend,
    onPreviewDraft: setPreviewEmail,
    isGeneratingFromPrompt,
    onBack: () => {
      setSourceError(null)
      setStep(2)
    },
    onClose: handleCloseWizard,
  }

  const wizardOverlayProps: WizardOverlayProps = {
    open: wizardOpen,
    onClose: handleCloseWizard,
    currentStep,
    sourceError,
    onClearSourceError: () => setSourceError(null),
    stepOne: wizardStepOne,
    stepTwo: wizardStepTwo,
    stepThree: wizardStepThree,
  }


  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-mono font-bold text-foreground">Outreach</h1>
        <p className="text-muted-foreground">Import your leads and Outreach them in one click</p>
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

      <WizardOverlay {...wizardOverlayProps} />

      <DraftPreviewPanel
        open={Boolean(previewEmail && outreachDraft)}
        lead={previewLead}
        draft={outreachDraft}
        editing={previewEditing}
        editedSubject={editedSubject}
        editedBody={editedBody}
        onEdit={startEditingPreview}
        onCancelEdit={cancelEditingPreview}
        onSave={saveEditedPreview}
        onClose={handleCloseDraftPreview}
        onChangeSubject={(value) => setEditedSubject(value)}
        onChangeBody={(value) => setEditedBody(value)}
        plainBodyRenderer={(draft) => htmlToPlainText(draft.bodyHtml ?? "")}
      />

      <OutreachHistory
        jobsLoading={jobsLoading}
        manualCampaigns={manualCampaigns}
        filteredCampaigns={filteredCampaigns}
        legacyJobs={legacyJobs}
        filteredLegacyJobs={filteredLegacyJobs}
        onRefresh={() => refetchOutreachJobs().catch(() => undefined)}
        onExportAll={() => handleExportOutreachedCsv(undefined, { fileLabel: "outreached-emails" })}
        onExportCampaign={handleExportOutreachedCsv}
        onSelectCampaign={setSelectedCampaign}
        onPreviewLegacyJob={setPreviewJob}
      />

      <SentEmailPanel
        open={Boolean(previewJob)}
        job={previewJob}
        onClose={() => setPreviewJob(null)}
        plainBodyRenderer={htmlToPlainText}
      />

      <SentCampaignPanel
        open={Boolean(selectedCampaign)}
        campaign={selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
        onExport={handleExportOutreachedCsv}
        onPreviewJob={(job) => setPreviewJob(job)}
      />

    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import axios, { CancelTokenSource } from "axios"
import { useQuery } from "@tanstack/react-query"
import { Search, UploadCloud } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGoogleSheets } from "@/hooks/useGoogleSheet"
import { useSavedSnippets } from "@/hooks/useSavedSnippets"
import { useGmail } from "@/hooks/useGmail"
import { createSavedSnippetAction } from "@/actions/saved-snippets"
import { getOutreachedJobsAction, sendBulkEmailsAction } from "@/actions/outreach"
import * as manualCampaignDraftActions from "@/actions/manual-campaign-drafts"
import {
  DraftRecord,
  ManualOutreachSource,
  OutreachedJob,
  OutreachMode,
  SheetLead,
} from "@/types/outreach"
import { SpreadsheetData } from "@/types/google-sheet"
import type { SavedSnippet } from "@/types/saved-snippet"
import { parseSheet } from "@/lib/leads/outreach"
import { formatEmailBody } from "@/lib/email/format"
import { DraftPreviewPanel } from "./components/draft-preview-panel"
import { WizardOverlay } from "./components/wizard-overlay"
import type { StepOneProps, StepTwoProps, StepThreeProps, WizardOverlayProps } from "./components/wizard-overlay"
import { OutreachHistory } from "./components/outreach-history"
import type { ChatMessage, ManualCampaignGroup, OutreachSourceType, WizardStep } from "./components/types"
import type { ManualCampaignDraft, ManualCampaignDraftStatus, PersistedWorkflowState } from "@/types/outreach-workflow"
import { htmlToPlainText } from "@/lib/email/format"

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

const LOCAL_STORAGE_KEY = "outbond.dashboard.outreach"

const generateManualCampaignId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `outreach-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function Leads() {
  const router = useRouter()
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
  const [savingCampaignDraft, setSavingCampaignDraft] = useState(false)
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null)

  const [previewEmail, setPreviewEmail] = useState<string | null>(null)
  const [previewEditing, setPreviewEditing] = useState(false)
  const [editedSubject, setEditedSubject] = useState("")
  const [editedBody, setEditedBody] = useState("")

  const generateCancelSourceRef = useRef<AbortController | null>(null)
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
    queryFn: getOutreachedJobsAction,
    staleTime: 1000 * 60,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const {
    data: draftCampaignsData,
    isLoading: draftsLoading,
    refetch: refetchCampaignDrafts,
  } = useQuery<ManualCampaignDraft[], Error>({
    queryKey: ["manualCampaignDrafts"],
    queryFn: manualCampaignDraftActions.getManualCampaignDraftsAction,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  })

  const { data: savedSnippetsData, refetch: refetchSavedSnippets } = useSavedSnippets()
  const savedSnippets = useMemo<SavedSnippet[]>(
    () => (Array.isArray(savedSnippetsData) ? savedSnippetsData : []),
    [savedSnippetsData],
  )

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

  const createAbortController = useCallback((holder: { current: AbortController | null }) => {
    if (holder.current) {
      holder.current.abort()
    }
    const controller = new AbortController()
    holder.current = controller
    return controller
  }, [])

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

  const buildWorkflowState = useCallback((): PersistedWorkflowState => {
    return {
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
  ])

  useEffect(() => {
    if (!resumeReady || typeof window === "undefined") {
      return
    }
    try {
      const payload = buildWorkflowState()
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.error("Failed to persist outreach workflow:", error)
    }
  }, [buildWorkflowState, resumeReady])

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

  const handleSavePromptSnippet = useCallback(
    async ({ name, content }: { name: string; content: string }) => {
      const payload = {
        name: name.trim(),
        content: content.trim(),
        type: "PROMPT" as const,
      }
      if (!payload.name || !payload.content) {
        throw new Error("Prompt name and content are required")
      }
      try {
        await createSavedSnippetAction(payload)
        toast.success("Prompt saved to your library")
        await refetchSavedSnippets().catch(() => undefined)
      } catch (error) {
        console.error("Failed to save prompt snippet:", error)
        toast.error(error instanceof Error ? error.message : "Failed to save prompt")
        throw error
      }
    },
    [refetchSavedSnippets],
  )

  const persistManualCampaignDraft = useCallback(
    async (nextStatus: ManualCampaignDraftStatus) => {
      const workflowState = buildWorkflowState()
      const draft = await manualCampaignDraftActions.persistManualCampaignDraftAction({
        id: workflowState.manualCampaignId,
        name: workflowState.campaignName,
        sourceType: workflowState.sourceType,
        status: nextStatus,
        state: workflowState,
      })
      if (draft) {
        setManualCampaignId(draft.id)
      }
      return draft
    },
    [buildWorkflowState],
  )

  useEffect(() => {
    if (!resumeReady) return
    if (!campaignName.trim() || !sourceType) return
    if (!manualCampaignId) return
    const timer = window.setTimeout(() => {
      void persistManualCampaignDraft("draft").catch(() => undefined)
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [
    campaignName,
    sourceType,
    manualCampaignId,
    promptInput,
    chatMessages,
    drafts,
    leads,
    sendingMode,
    uploadedFileMeta,
    persistManualCampaignDraft,
    resumeReady,
  ])

  const handleSaveCampaignDraft = useCallback(async () => {
    if (!campaignName.trim() || !sourceType || leads.length === 0) {
      toast.error("Name your campaign, choose a source, and load leads before saving it.")
      return
    }
    setSavingCampaignDraft(true)
    try {
      const saved = await persistManualCampaignDraft("draft")
      if (saved) {
        toast.success(`Saved “${saved.name}” as a draft campaign`)
        await refetchCampaignDrafts().catch(() => undefined)
      }
    } catch (error) {
      console.error("Manual campaign draft save failed:", error)
      if (axios.isAxiosError(error)) {
        const message = (error.response?.data as { error?: string })?.error ?? "Failed to save draft campaign"
        toast.error(message)
      } else {
        toast.error("Failed to save draft campaign")
      }
    } finally {
      setSavingCampaignDraft(false)
    }
  }, [campaignName, leads, persistManualCampaignDraft, refetchCampaignDrafts, sourceType])

  const handleResumeCampaignDraft = useCallback((draft: ManualCampaignDraft) => {
    const state = draft.workflowState
    const safeLeads = Array.isArray(state.leads) ? state.leads : []
    const safeChats = Array.isArray(state.chatMessages) ? state.chatMessages : []

    setCampaignName(state.campaignName ?? draft.name ?? "")
    setManualCampaignId(draft.id)
    setSourceType(state.sourceType ?? draft.sourceType ?? null)
    const nextStep = (state.currentStep ?? 1) as WizardStep
    setCurrentStep(nextStep)
    setSelectedSheetId(state.selectedSheetId ?? "")
    setSheetRange(state.sheetRange ?? "")
    setLeads(safeLeads)
    setPromptInput(state.promptInput ?? "")
    setChatMessages(safeChats)
    setDrafts(state.drafts ?? {})
    setSendingMode(state.sendingMode ?? "single")
    setUploadedFileMeta(state.uploadedFileMeta ?? null)
    setWizardOpen(true)
    setPreviewEmail(null)
    setSourceError(null)
    toast.success(`Draft “${draft.name}” loaded`)
  }, [])

  const handleDeleteCampaignDraft = useCallback(
    async (draftId: string) => {
      setDeletingDraftId(draftId)
      try {
        await manualCampaignDraftActions.deleteManualCampaignDraftAction(draftId)
        if (manualCampaignId === draftId) {
          setManualCampaignId(null)
        }
        toast.success("Draft removed")
        await refetchCampaignDrafts().catch(() => undefined)
      } catch (error) {
        console.error("Failed to delete draft campaign:", error)
        toast.error(error instanceof Error ? error.message : "Failed to delete draft campaign")
      } finally {
        setDeletingDraftId(null)
      }
    },
    [manualCampaignId, refetchCampaignDrafts],
  )

  const syncDraftStatus = useCallback(
    async (nextStatus: ManualCampaignDraftStatus) => {
      try {
        await persistManualCampaignDraft(nextStatus)
        await refetchCampaignDrafts().catch(() => undefined)
      } catch (error) {
        console.warn("Failed to update manual campaign draft status:", error)
      }
    },
    [persistManualCampaignDraft, refetchCampaignDrafts],
  )

  const handleSourceTypeChange = useCallback(
    (next: OutreachSourceType) => {
      setSourceType((previous) => {
        if (previous === next) {
          return previous
        }
        return next
      })
      generateCancelSourceRef.current?.abort()
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
      generateCancelSourceRef.current?.abort()
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

  const manualCampaigns = useMemo(() => {
    const map = new Map<string, ManualCampaignGroup>()
    outreachedJobs.forEach((job) => {
      if (!job.manualCampaignId) {
        return
      }
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
    })
    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.lastSentAt ? new Date(a.lastSentAt).getTime() : 0
      const bTime = b.lastSentAt ? new Date(b.lastSentAt).getTime() : 0
      return bTime - aTime
    })
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

  const savedPrompts = useMemo(() => savedSnippets.filter((snippet) => snippet.type === "PROMPT"), [savedSnippets])
  const savedSignatures = useMemo(
    () => savedSnippets.filter((snippet) => snippet.type === "SIGNATURE"),
    [savedSnippets],
  )

  const draftCampaigns = useMemo<ManualCampaignDraft[]>(() => {
    return (draftCampaignsData ?? []).filter((draft) => draft.status === "draft")
  }, [draftCampaignsData])

  const canSaveCampaignDraft = useMemo(
    () => Boolean(campaignName.trim() && sourceType && leads.length > 0),
    [campaignName, leads, sourceType],
  )

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

  const handleNavigateToCampaign = useCallback(
    (campaignId: string) => {
      router.push(`/dashboard/outreach/${campaignId}`)
    },
    [router],
  )

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
        setSheetRange(`${firstTab}!A:N`)
      }
    }
  }

  const handlePromptSubmit = async () => {
    const trimmedPrompt = promptInput.trim()
    if (!leads.length) {
      setSourceError("Load leads before generating drafts")
      setSheetsError(null)
      toast.error("Load leads first")
      return
    }
    if (!trimmedPrompt) {
      setSourceError("Add a prompt so the AI knows what to write")
      toast.error("Describe the outreach email you want before generating drafts")
      return
    }
    if (leads.length > 50) {
      const message = "The outreach generator can handle up to 50 leads per batch. Narrow your range before continuing."
      setSourceError(message)
      toast.error(message)
      return
    }

    type DraftChunk = { email: string; subject: string; bodyHtml: string; bodyText: string }
    type StreamEvent =
      | { type: "status"; phase: "working" | "generating" | "finalizing"; total: number; completed: number }
      | { type: "done"; drafts: DraftChunk[] }
      | { type: "error"; message: string }

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

    const updateAssistant = (content: string, status?: ChatMessage["status"]) => {
      setChatMessages((prev) =>
        prev.map((message) =>
          message.id === assistantMessageId ? { ...message, content, ...(status ? { status } : {}) } : message,
        ),
      )
    }

    const phaseMessage = (event: Extract<StreamEvent, { type: "status" }>) => {
      if (event.phase === "working") {
        return "Working on your request…"
      }
      if (event.phase === "generating") {
        return `Generating emails (${event.completed}/${event.total})…`
      }
      return "Finalizing your drafts…"
    }

    let controller: AbortController | null = null
    try {
      controller = createAbortController(generateCancelSourceRef)
      const response = await fetch("/api/email/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: leads.map((lead) => ({
            email: lead.email,
            firstName: lead.firstName,
            lastName: lead.lastName,
            company: lead.company,
            summary: lead.summary,
            role: lead.role,
          })),
          sender: {
            name: gmailStatus?.emailAddress?.split("@")[0] || undefined,
            prompt: trimmedPrompt,
          },
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        let errorMessage = "Failed to generate outreach drafts"
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload?.error) {
            errorMessage = payload.error
          }
        } catch {
          // ignore json errors
        }
        throw new Error(errorMessage)
      }

      if (!response.body) {
        throw new Error("Streaming responses are not supported in this browser.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let streamedDrafts: DraftChunk[] = []

      const processLine = (line: string) => {
        if (!line) return
        let event: StreamEvent
        try {
          event = JSON.parse(line)
        } catch {
          console.warn("Skipping malformed stream chunk:", line)
          return
        }
        if (event.type === "status") {
          updateAssistant(phaseMessage(event))
          return
        }
        if (event.type === "error") {
          throw new Error(event.message || "Failed to generate outreach drafts")
        }
        if (event.type === "done") {
          streamedDrafts = Array.isArray(event.drafts) ? event.drafts : []
        }
      }

      while (true) {
        const { value, done } = await reader.read()
        if (value) {
          buffer += decoder.decode(value, { stream: !done })
          let newlineIndex = buffer.indexOf("\n")
          while (newlineIndex >= 0) {
            const line = buffer.slice(0, newlineIndex).trim()
            buffer = buffer.slice(newlineIndex + 1)
            processLine(line)
            newlineIndex = buffer.indexOf("\n")
          }
        }
        if (done) {
          buffer += decoder.decode()
          if (buffer.trim()) {
            processLine(buffer.trim())
          }
          break
        }
      }

      const generated = streamedDrafts ?? []
      if (!generated.length) {
        updateAssistant("I couldn't generate any drafts. Try adjusting your prompt and run it again.", "error")
        toast.error("No drafts were generated. Try refining your prompt.")
        return
      }

      const nextDrafts = generated.reduce<Record<string, DraftRecord>>((acc, item) => {
        if (!item.email) return acc
        acc[item.email] = {
          subject: item.subject.trim(),
          bodyHtml: item.bodyHtml,
          bodyText: item.bodyText,
          status: "pending",
        }
        return acc
      }, {})

      setDrafts(nextDrafts)

      const missingCount = leads.length - generated.length
      const summary =
        missingCount > 0
          ? `Generated ${generated.length} drafts. ${missingCount} lead${missingCount === 1 ? "" : "s"} were skipped—check their data and try again if needed.`
          : `Generated drafts for all ${generated.length} leads.`

      updateAssistant(summary, "success")
      toast.success(`Prepared ${generated.length} drafts`)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setChatMessages((prev) => prev.filter((message) => message.id !== assistantMessageId))
        return
      }

      console.error("Draft generation error:", error)
      const message = error instanceof Error ? error.message : "Failed to generate outreach drafts"
      setSourceError(message)
      updateAssistant(message, "error")
      toast.error(message)
    } finally {
      if (controller && generateCancelSourceRef.current === controller) {
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
            leadEmail: email,
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
        .filter((job): job is NonNullable<typeof job> => Boolean(job))

      if (!jobs.length) {
        setSourceError('No drafts available for the selected leads')
        return
      }

      cancelSource = createCancelSource(sendCancelSourceRef)

      await sendBulkEmailsAction({ jobs })

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
      await syncDraftStatus('sent')
      await refetchOutreachJobs().catch(() => undefined)
    } catch (error) {
      if (axios.isCancel(error)) {
        return
      }
      console.error('Email queue error:', error)
      const message = error instanceof Error ? error.message : 'Failed to queue outreach emails'
      setSourceError(message)
      toast.error(message)
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
    savedPrompts,
    savedSignatures,
    onSavePromptSnippet: handleSavePromptSnippet,
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
    onSaveDraftCampaign: handleSaveCampaignDraft,
    savingDraftCampaign: savingCampaignDraft,
    canSaveDraftCampaign: canSaveCampaignDraft,
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
        draftsLoading={draftsLoading}
        draftCampaigns={draftCampaigns}
        deletingDraftId={deletingDraftId}
        manualCampaigns={manualCampaigns}
        filteredCampaigns={filteredCampaigns}
        onResumeDraft={handleResumeCampaignDraft}
        onDeleteDraft={handleDeleteCampaignDraft}
        onRefresh={() => refetchOutreachJobs().catch(() => undefined)}
        onExportAll={() => handleExportOutreachedCsv(undefined, { fileLabel: "outreached-emails" })}
        onExportCampaign={handleExportOutreachedCsv}
        onNavigateCampaign={handleNavigateToCampaign}
      />

    </div>
  )
}

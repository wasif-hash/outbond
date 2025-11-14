"use client"

import { type ChangeEvent, type RefObject, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SheetSelector } from "@/components/google-sheet/SheetSelector"
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
import { BookmarkPlus, Eye, PenLine, Save, Send, Upload, UploadCloud } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { FastSpinner } from "./FastSpinner"
import type { DraftRecord, OutreachMode, SheetLead } from "@/types/outreach"
import type { GoogleSpreadsheet } from "@/types/google-sheet"

import type { ChatMessage, OutreachSourceType, WizardStep } from "./types"
import { OverlayPanel } from "./overlay-panel"
import { statusVariant } from "@/lib/leads/outreach"
import type { SavedSnippet } from "@/types/saved-snippet"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type SourceOption = {
  value: OutreachSourceType
  label: string
  description: string
}

const deriveSnippetName = (content: string) => {
  const firstLine = content.split("\n").find((line) => line.trim().length > 0) ?? "Prompt"
  return firstLine.slice(0, 60)
}

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ")

type SavedSnippetSelectorProps = {
  icon: LucideIcon
  label: string
  items: SavedSnippet[]
  emptyLabel: string
  onSelect: (snippet: SavedSnippet) => void
}

function SavedSnippetSelector({ icon: Icon, label, items, emptyLabel, onSelect }: SavedSnippetSelectorProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const handleSelect = (snippet: SavedSnippet) => {
    onSelect(snippet)
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          "h-9 w-9 rounded-full border border-border bg-background/95 text-foreground shadow-sm",
          open ? "bg-primary/15 text-primary" : "",
        )}
        onClick={() => setOpen((prev) => !prev)}
        title={label}
      >
        <Icon className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-md border border-border bg-popover shadow-lg">
          <div className="border-b px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
          {items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            <ul className="max-h-60 overflow-auto py-1">
              {items.map((snippet) => (
                <li key={snippet.id}>
                  <button
                    type="button"
                    className="flex w-full items-center px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                    onClick={() => handleSelect(snippet)}
                  >
                    {snippet.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

export type StepOneProps = {
  campaignName: string
  onCampaignNameChange: (value: string) => void
  sourceOptions: SourceOption[]
  sourceType: OutreachSourceType | null
  onSourceTypeChange: (value: OutreachSourceType) => void
  spreadsheets: GoogleSpreadsheet[]
  selectedSheetId: string
  onSelectedSheetIdChange: (value: string) => void
  sheetRange: string
  onSheetRangeChange: (value: string) => void
  onSheetSelectOpen: (open: boolean) => void
  onLoadSheet: () => void
  onRefreshSheets: () => void
  sheetsLoading: boolean
  sheetsError: string | null
  onClearSheetsError: () => void
  hasLeads: boolean
  leadsCount: number
  importingLeads: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  uploadedFileMeta: { name: string; importedAt: number; rowCount: number } | null
  canProceed: boolean
  onNext: () => void
  onCancel: () => void
}

export type StepTwoProps = {
  chatMessages: ChatMessage[]
  promptInput: string
  onPromptInputChange: (value: string) => void
  onPromptSubmit: () => void
  isGeneratingFromPrompt: boolean
  hasDrafts: boolean
  savedPrompts: SavedSnippet[]
  savedSignatures: SavedSnippet[]
  onSavePromptSnippet: (payload: { name: string; content: string }) => Promise<void>
  onPrevious: () => void
  onNext: () => void
}

export type StepThreeProps = {
  filteredLeads: SheetLead[]
  leads: SheetLead[]
  drafts: Record<string, DraftRecord>
  sendingMode: OutreachMode
  onSendingModeChange: (mode: OutreachMode) => void
  sendSingleEmail: (email: string) => void
  sendingLeadEmail: string | null
  sendingEmails: boolean
  outreachUnavailable: boolean
  hasDrafts: boolean
  pendingDraftCount: number
  onBulkSendClick: () => void
  bulkDialogOpen: boolean
  onBulkDialogChange: (open: boolean) => void
  confirmBulkSend: () => void
  onPreviewDraft: (email: string) => void
  isGeneratingFromPrompt: boolean
  onSaveDraftCampaign: () => void
  savingDraftCampaign: boolean
  canSaveDraftCampaign: boolean
  onBack: () => void
  onClose: () => void
}

export type WizardOverlayProps = {
  open: boolean
  onClose: () => void
  currentStep: WizardStep
  sourceError: string | null
  onClearSourceError: () => void
  stepOne: StepOneProps
  stepTwo: StepTwoProps
  stepThree: StepThreeProps
}

export function WizardOverlay({
  open,
  onClose,
  currentStep,
  sourceError,
  onClearSourceError,
  stepOne,
  stepTwo,
  stepThree,
}: WizardOverlayProps) {
  const renderStepIndicator = () => (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="outline" className="font-mono uppercase">
        Step {currentStep}
      </Badge>
      <span>{currentStep === 1 ? "Select lead source" : currentStep === 2 ? "Customize prompt" : "Review & send"}</span>
    </div>
  )

  return (
    <OverlayPanel
      open={open}
      onClose={onClose}
      contentClassName="max-w-[min(1100px,calc(100vw-2rem))]"
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className="border-b border-border px-6 py-5">
          {renderStepIndicator()}
          <h2 className="mt-2 text-lg font-semibold text-foreground">
            {stepOne.campaignName ? stepOne.campaignName : "Launch outreach campaign"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Step {currentStep} of 3
            {stepOne.sourceType ? ` · ${stepOne.sourceType === "google-sheet" ? "Google Sheet" : "File upload"}` : ""}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {currentStep === 1 ? (
            <StepOneContent {...stepOne} />
          ) : currentStep === 2 ? (
            <StepTwoContent {...stepTwo} />
          ) : (
            <StepThreeContent {...stepThree} />
          )}
        </div>

        {sourceError ? (
          <div className="border-t border-destructive/40 bg-destructive/10 px-6 py-3 text-sm text-destructive">
            <div className="flex items-center justify-between gap-3">
              <span>{sourceError}</span>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onClearSourceError}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </OverlayPanel>
  )
}

function StepOneContent({
  campaignName,
  onCampaignNameChange,
  sourceOptions,
  sourceType,
  onSourceTypeChange,
  spreadsheets,
  selectedSheetId,
  onSelectedSheetIdChange,
  sheetRange,
  onSheetRangeChange,
  onSheetSelectOpen,
  onLoadSheet,
  onRefreshSheets,
  sheetsLoading,
  sheetsError,
  onClearSheetsError,
  hasLeads,
  leadsCount,
  importingLeads,
  fileInputRef,
  onFileInputChange,
  uploadedFileMeta,
  canProceed,
  onNext,
  onCancel,
}: StepOneProps) {

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="outreach-campaign-name">
          Campaign name
        </label>
        <Input
          id="outreach-campaign-name"
          value={campaignName}
          onChange={(event) => onCampaignNameChange(event.target.value)}
          placeholder="Ex: HR Directors – Feb 2025"
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Lead source</p>
        <div className="space-y-2">
          {sourceOptions.map((option) => {
            const isActive = sourceType === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSourceTypeChange(option.value)}
                className={cn(
                  "w-full rounded-lg border p-4 text-left transition",
                  isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/50",
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
              <SheetSelector
                sheets={spreadsheets}
                value={selectedSheetId}
                onChange={onSelectedSheetIdChange}
                disabled={spreadsheets.length === 0 && sheetsLoading}
                loading={sheetsLoading}
                emptyMessage="No sheets match your search."
                onOpenChange={onSheetSelectOpen}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Range</label>
              <Input value={sheetRange} onChange={(event) => onSheetRangeChange(event.target.value)} placeholder="Sheet1!A:P" />
              <p className="text-xs text-muted-foreground">Use `Tab!A:Z` to limit rows.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Actions</label>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={onLoadSheet} disabled={sheetsLoading || !selectedSheetId}>
                  {sheetsLoading ? <FastSpinner size="sm" className="mr-2" /> : null}
                  Load data
                </Button>
                <Button type="button" variant="outline" onClick={onRefreshSheets} disabled={sheetsLoading}>
                  Refresh library
                </Button>
              </div>
            </div>
          </div>
          {sheetsError ? <ErrorBanner message={sheetsError} onClose={onClearSheetsError} /> : null}
          {hasLeads ? (
            <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              Loaded {leadsCount} leads from the selected sheet.
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
            onChange={onFileInputChange}
          />
          {uploadedFileMeta ? (
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              Loaded {uploadedFileMeta.rowCount} leads from {uploadedFileMeta.name} ·{" "}
              {new Date(uploadedFileMeta.importedAt).toLocaleString()}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </div>
    </div>
  )
}

function StepTwoContent({
  chatMessages,
  promptInput,
  onPromptInputChange,
  onPromptSubmit,
  isGeneratingFromPrompt,
  hasDrafts,
  savedPrompts,
  savedSignatures,
  onSavePromptSnippet,
  onPrevious,
  onNext,
}: StepTwoProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveSnippetName, setSaveSnippetName] = useState("")
  const [saveSnippetContent, setSaveSnippetContent] = useState("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savingSnippet, setSavingSnippet] = useState(false)

  const openSaveDialog = (content: string) => {
    setSaveSnippetContent(content)
    setSaveSnippetName(deriveSnippetName(content))
    setSaveError(null)
    setSaveDialogOpen(true)
  }

  const handleConfirmSave = async () => {
    const trimmedName = saveSnippetName.trim()
    if (!trimmedName) {
      setSaveError("Give this prompt a name before saving.")
      return
    }
    setSaveError(null)
    setSavingSnippet(true)
    try {
      await onSavePromptSnippet({ name: trimmedName, content: saveSnippetContent })
      setSaveDialogOpen(false)
      setSaveSnippetName("")
      setSaveSnippetContent("")
    } catch (error) {
      console.error("Prompt save failed:", error)
      setSaveError("We couldn't save this prompt. Try again.")
    } finally {
      setSavingSnippet(false)
    }
  }

  const insertPrompt = (snippet: SavedSnippet) => {
    onPromptInputChange(snippet.content)
  }

  const insertSignature = (snippet: SavedSnippet) => {
    const signatureText = stripHtml(snippet.content).trim()
    const base = promptInput.trim().length ? `${promptInput.trim()}\n\nSignature:\n${signatureText}` : signatureText
    onPromptInputChange(base)
  }


  return (
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
              const canSave = message.role === "user" && Boolean(message.content?.trim())
              return (
                <ChatBubble
                  key={message.id}
                  message={message}
                  onSave={canSave ? () => openSaveDialog(message.content) : undefined}
                />
              )
            })}
          </div>
        )}
      </div>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          onPromptSubmit()
        }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
          <div className="relative flex-1">
            <Input
              value={promptInput}
              onChange={(event) => onPromptInputChange(event.target.value)}
              placeholder="Example: Reference their Series B, mention how we halve onboarding time"
              className="h-14 rounded-2xl border border-input bg-background pr-32 text-base font-medium"
            />
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 gap-2">
              <SavedSnippetSelector
                icon={Upload}
                label="Prompts"
                items={savedPrompts}
                emptyLabel="No prompts saved"
                onSelect={insertPrompt}
              />
              <SavedSnippetSelector
                icon={PenLine}
                label="Signatures"
                items={savedSignatures}
                emptyLabel="No signatures saved"
                onSelect={insertSignature}
              />
            </div>
          </div>
          <Button type="submit" disabled={isGeneratingFromPrompt} className="h-14 w-full rounded-2xl md:w-56">
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
        <p className="text-xs text-muted-foreground">
          Mention tone, proof points, objections, and CTA. Use the icons to load saved prompts or signatures.
        </p>
      </form>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" onClick={onPrevious}>
          Previous
        </Button>
        <Button type="button" onClick={onNext} disabled={!hasDrafts}>
          Next
        </Button>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={(open) => (!savingSnippet ? setSaveDialogOpen(open) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this prompt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Prompt name"
              value={saveSnippetName}
              onChange={(event) => setSaveSnippetName(event.target.value)}
            />
            <Textarea value={saveSnippetContent} readOnly rows={6} className="text-sm" />
            {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={savingSnippet}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirmSave} disabled={savingSnippet}>
              {savingSnippet ? <FastSpinner size="sm" className="mr-2" /> : null}
              Save prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StepThreeContent({
  filteredLeads,
  leads,
  drafts,
  sendingMode,
  onSendingModeChange,
  sendSingleEmail,
  sendingLeadEmail,
  sendingEmails,
  outreachUnavailable,
  hasDrafts,
  pendingDraftCount,
  onBulkSendClick,
  bulkDialogOpen,
  onBulkDialogChange,
  confirmBulkSend,
  isGeneratingFromPrompt,
  onPreviewDraft,
  onSaveDraftCampaign,
  savingDraftCampaign,
  canSaveDraftCampaign,
  onBack,
  onClose,
}: StepThreeProps) {
  return (
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

      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 sm:flex sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Save this campaign as a draft</p>
          <p className="text-xs text-muted-foreground">
            We’ll store your prompt, leads, and generated drafts so you can resume later.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full sm:mt-0 sm:w-auto"
          disabled={!canSaveDraftCampaign || savingDraftCampaign}
          onClick={onSaveDraftCampaign}
        >
          {savingDraftCampaign ? <FastSpinner size="sm" className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
          Save draft campaign
        </Button>
      </div>

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
                        {lead.summary ? (
                          <div className="text-xs text-muted-foreground line-clamp-1">{lead.summary}</div>
                        ) : null}
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
                            onClick={() => onPreviewDraft(lead.email)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                          {sendingMode === "single" ? (
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
                              {isSendingThisLead ? <FastSpinner size="sm" className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
                              Send
                            </Button>
                          ) : null}
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
              onClick={() => onSendingModeChange("single")}
            >
              Single send
            </Button>
            <Button
              type="button"
              variant={sendingMode === "bulk" ? "default" : "outline"}
              size="sm"
              onClick={() => onSendingModeChange("bulk")}
            >
              Bulk send
            </Button>
          </div>

          {sendingMode === "bulk" ? (
            <>
              <Button
                type="button"
                onClick={onBulkSendClick}
                disabled={sendingEmails || outreachUnavailable || !pendingDraftCount}
                className="flex w-full justify-center sm:w-auto"
              >
                {sendingEmails ? <FastSpinner size="sm" className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
                Send {pendingDraftCount} emails
              </Button>

              <AlertDialog open={bulkDialogOpen} onOpenChange={onBulkDialogChange}>
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

          {outreachUnavailable ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Connect your Gmail account in Settings before sending outreach emails.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Previous
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}

function ChatBubble({ message, onSave }: { message: ChatMessage; onSave?: () => void }) {
  const isUser = message.role === "user"
  const isError = message.status === "error"
  const bubbleClass = cn(
    "max-w-[75%] rounded-lg px-4 py-3 text-sm shadow-sm",
    isUser ? "text-black" : "bg-muted/60 text-foreground",
    isError ? "bg-red-100 text-red-900" : "",
  )

  return (
    <div className={cn("flex items-start gap-2", isUser ? "justify-end" : "justify-start")}>
      {isUser && onSave ? (
        <button
          type="button"
          className="mt-1 rounded-full border border-border bg-background/90 p-1 text-muted-foreground transition hover:text-foreground"
          onClick={onSave}
          title="Save this prompt"
        >
          <BookmarkPlus className="h-4 w-4" />
        </button>
      ) : null}
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
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onClose}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}

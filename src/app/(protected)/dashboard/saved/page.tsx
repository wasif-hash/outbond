"use client"

import { useMemo, useState } from "react"
import axios from "axios"
import { Bookmark, Copy, PenLine, PlusCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FastSpinner } from "@/app/(protected)/dashboard/outreach/components/FastSpinner"
import type { SavedSnippet, SavedSnippetType } from "@/types/saved-snippet"
import { Textarea } from "@/components/ui/textarea"
import { QuillPromptEditor } from "@/components/ui/quill-prompt-editor"
import { useSavedSnippets } from "@/hooks/useSavedSnippets"

type FormState = {
  name: string
  content: string
}

const INITIAL_FORM: FormState = { name: "", content: "" }
const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ")

async function fetchSavedSnippets() {
  const response = await axios.get<{ snippets: SavedSnippet[] }>("/api/saved-items")
  return response.data.snippets ?? []
}

export default function SavedPage() {
  const [promptForm, setPromptForm] = useState<FormState>(INITIAL_FORM)
  const [signatureForm, setSignatureForm] = useState<FormState>(INITIAL_FORM)
  const [submittingPrompt, setSubmittingPrompt] = useState(false)
  const [submittingSignature, setSubmittingSignature] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const {
    data: snippets,
    isLoading,
    refetch: refetchSnippets,
    isRefetching,
  } = useSavedSnippets()

  const prompts = useMemo(() => (snippets ?? []).filter((item) => item.type === "PROMPT"), [snippets])
  const signatures = useMemo(() => (snippets ?? []).filter((item) => item.type === "SIGNATURE"), [snippets])

  const resetForm = (type: SavedSnippetType) => {
    if (type === "PROMPT") {
      setPromptForm(INITIAL_FORM)
    } else {
      setSignatureForm(INITIAL_FORM)
    }
  }

  const handleCreateSnippet = async (type: SavedSnippetType) => {
    const form = type === "PROMPT" ? promptForm : signatureForm
    const { name, content } = form
    const trimmedName = name.trim()
    const trimmedContent = content.trim()
    const effectiveContent = type === "SIGNATURE" ? stripHtml(trimmedContent).trim() : trimmedContent
    if (!trimmedName || !effectiveContent) {
      toast.error("Add a name and content before saving.")
      return
    }

    if (type === "PROMPT") {
      setSubmittingPrompt(true)
    } else {
      setSubmittingSignature(true)
    }
    try {
      await axios.post("/api/saved-items", {
        name: trimmedName,
        content: trimmedContent,
        type,
      })
      toast.success(type === "PROMPT" ? "Prompt saved" : "Signature saved")
      resetForm(type)
      await refetchSnippets()
    } catch (error) {
      console.error("Failed to save snippet:", error)
      toast.error("Unable to save right now.")
    } finally {
      if (type === "PROMPT") {
        setSubmittingPrompt(false)
      } else {
        setSubmittingSignature(false)
      }
    }
  }

  const handleDeleteSnippet = async (id: string) => {
    setDeletingId(id)
    try {
      await axios.delete(`/api/saved-items/${id}`)
      toast.success("Removed from saved items")
      await refetchSnippets()
    } catch (error) {
      console.error("Failed to delete snippet:", error)
      toast.error("Unable to delete right now.")
    } finally {
      setDeletingId(null)
    }
  }

  const handleCopySnippet = async (item: SavedSnippet) => {
    try {
      if (
        item.type === "SIGNATURE" &&
        typeof window !== "undefined" &&
        "ClipboardItem" in window &&
        navigator.clipboard?.write
      ) {
        const clipboardItem = new ClipboardItem({
          "text/html": new Blob([item.content], { type: "text/html" }),
          "text/plain": new Blob([stripHtml(item.content)], { type: "text/plain" }),
        })
        await navigator.clipboard.write([clipboardItem])
      } else {
        await navigator.clipboard.writeText(item.content)
      }
      toast.success(`${item.type === "PROMPT" ? "Prompt" : "Signature"} copied to clipboard`)
    } catch (error) {
      console.error("Clipboard error:", error)
      toast.error("Failed to copy")
    }
  }

  const renderList = (items: SavedSnippet[], type: SavedSnippetType) => {
    if (isLoading) {
      return (
        <div className="flex h-36 items-center justify-center gap-2 text-sm text-muted-foreground">
          <FastSpinner size="sm" />
          Loading {type === "PROMPT" ? "prompts" : "signatures"}…
        </div>
      )
    }

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          {type === "PROMPT"
            ? "You haven’t saved any prompts yet. Use the form above or the Step 2 chat to save one."
            : "No signatures saved yet. Add your favorite closing or CTA to reuse it later."}
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-border bg-background p-4 shadow-sm shadow-black/[0.02]"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{item.name}</p>
              <Badge variant="outline" className="text-[10px] uppercase">
                {type === "PROMPT" ? "Prompt" : "Signature"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Updated {new Date(item.updatedAt).toLocaleString()}
              </span>
            </div>
            {type === "PROMPT" ? (
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>
            ) : (
              <div
                className="mt-3 rounded-md border border-border bg-muted/20 p-3 text-sm text-foreground"
                dangerouslySetInnerHTML={{ __html: item.content }}
              />
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleCopySnippet(item)
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteSnippet(item.id)}
                disabled={deletingId === item.id}
              >
                {deletingId === item.id ? <FastSpinner size="sm" className="mr-2" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold text-foreground">Saved snippets</h1>
          <p className="text-sm text-muted-foreground">
            Store prompts and email signatures to reuse inside the outreach flow.
          </p>
        </div>
        <Badge variant="outline" className="text-xs uppercase">
          {isRefetching ? "Syncing…" : `${snippets?.length ?? 0} saved`}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card shadow-sm shadow-black/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Bookmark className="h-4 w-4 text-primary" />
              Save a prompt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Prompt name"
              value={promptForm.name}
              onChange={(event) => setPromptForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Textarea
              placeholder="Describe tone, proof points, CTA, etc."
              rows={5}
              value={promptForm.content}
              onChange={(event) => setPromptForm((prev) => ({ ...prev, content: event.target.value }))}
            />
            <Button type="button" onClick={() => handleCreateSnippet("PROMPT")} disabled={submittingPrompt}>
              {submittingPrompt ? (
                <>
                  <FastSpinner size="sm" className="mr-2" />
                  Saving…
                </>
              ) : (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Save prompt
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm shadow-black/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <PenLine className="h-4 w-4 text-primary" />
              Save a signature
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Signature name"
              value={signatureForm.name}
              onChange={(event) => setSignatureForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <QuillPromptEditor
              value={signatureForm.content}
              onChange={(html) => setSignatureForm((prev) => ({ ...prev, content: html }))}
              placeholder="Add formatting, links, and size adjustments"
              output="html"
            />
            <Button type="button" onClick={() => handleCreateSnippet("SIGNATURE")} disabled={submittingSignature}>
              {submittingSignature ? (
                <>
                  <FastSpinner size="sm" className="mr-2" />
                  Saving…
                </>
              ) : (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Save signature
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Saved prompts</CardTitle>
          </CardHeader>
          <CardContent>{renderList(prompts, "PROMPT")}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Saved signatures</CardTitle>
          </CardHeader>
          <CardContent>{renderList(signatures, "SIGNATURE")}</CardContent>
        </Card>
      </div>
    </div>
  )
}

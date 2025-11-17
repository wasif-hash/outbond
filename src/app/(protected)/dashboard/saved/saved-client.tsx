"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Bookmark, Copy, PenLine, PlusCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { QuillPromptEditor } from "@/components/ui/quill-prompt-editor"
import { FastSpinner } from "@/app/(protected)/dashboard/outreach/components/FastSpinner"
import type { SavedSnippet, SavedSnippetType } from "@/types/saved-snippet"
import { createSavedSnippetAction, deleteSavedSnippetAction } from "@/actions/saved-snippets"

type FormState = {
  name: string
  content: string
}

const INITIAL_FORM: FormState = { name: "", content: "" }
const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ")

type SavedClientProps = {
  initialSnippets: SavedSnippet[]
}

export function SavedClient({ initialSnippets }: SavedClientProps) {
  const [promptForm, setPromptForm] = useState<FormState>(INITIAL_FORM)
  const [signatureForm, setSignatureForm] = useState<FormState>(INITIAL_FORM)
  const [snippets, setSnippets] = useState<SavedSnippet[]>(initialSnippets)
  const [submittingPrompt, setSubmittingPrompt] = useState(false)
  const [submittingSignature, setSubmittingSignature] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isRefreshing, startTransition] = useTransition()
  const router = useRouter()

  const prompts = useMemo(() => snippets.filter((item) => item.type === "PROMPT"), [snippets])
  const signatures = useMemo(() => snippets.filter((item) => item.type === "SIGNATURE"), [snippets])

  const resetForm = (type: SavedSnippetType) => {
    if (type === "PROMPT") {
      setPromptForm(INITIAL_FORM)
    } else {
      setSignatureForm(INITIAL_FORM)
    }
  }

  const refreshFromServer = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const handleCreateSnippet = async (type: SavedSnippetType) => {
    const form = type === "PROMPT" ? promptForm : signatureForm
    const trimmedName = form.name.trim()
    const trimmedContent = form.content.trim()
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
      const snippet = await createSavedSnippetAction({
        name: trimmedName,
        content: trimmedContent,
        type,
      })
      toast.success(type === "PROMPT" ? "Prompt saved" : "Signature saved")
      setSnippets((prev) => [snippet, ...prev])
      resetForm(type)
      refreshFromServer()
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
      await deleteSavedSnippetAction(id)
      setSnippets((prev) => prev.filter((snippet) => snippet.id !== id))
      toast.success("Removed from saved items")
      refreshFromServer()
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
                {deletingId === item.id ? (
                  <FastSpinner size="sm" className="mr-2" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
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
            Store your favourite prompts and signatures so you can reuse them during outreach.
          </p>
        </div>
        {isRefreshing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FastSpinner size="sm" />
            Syncing…
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-2">
            <CardTitle className="flex items-center gap-2 text-lg font-mono">
              <PenLine className="h-4 w-4 text-primary" />
              New prompt
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Draft a reusable outreach prompt. These appear in the Step 2 wizard inside Outreach.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => {
              event.preventDefault()
              void handleCreateSnippet("PROMPT")
            }}>
              <Input
                placeholder="A/B test prompt name"
                value={promptForm.name}
                onChange={(event) => setPromptForm((state) => ({ ...state, name: event.target.value }))}
                disabled={submittingPrompt}
              />
              <Textarea
                placeholder="Describe the outreach email you want to generate..."
                rows={8}
                value={promptForm.content}
                onChange={(event) => setPromptForm((state) => ({ ...state, content: event.target.value }))}
                disabled={submittingPrompt}
              />
              <div className="flex items-center justify-end">
                <Button type="submit" disabled={submittingPrompt}>
                  {submittingPrompt ? (
                    <>
                      <FastSpinner size="sm" className="mr-2" /> Saving…
                    </>
                  ) : (
                    <>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Save prompt
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2">
            <CardTitle className="flex items-center gap-2 text-lg font-mono">
              <Bookmark className="h-4 w-4 text-primary" />
              New signature
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Save your favourite closing lines, CTAs, or sign-offs. These can be inserted into drafts.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => {
              event.preventDefault()
              void handleCreateSnippet("SIGNATURE")
            }}>
              <Input
                placeholder="Signature name"
                value={signatureForm.name}
                onChange={(event) => setSignatureForm((state) => ({ ...state, name: event.target.value }))}
                disabled={submittingSignature}
              />
              <div className="rounded-lg border border-border">
                <QuillPromptEditor
                  value={signatureForm.content}
                  onChange={(value) => setSignatureForm((state) => ({ ...state, content: value }))}
                  readOnly={submittingSignature}
                />
              </div>
              <div className="flex items-center justify-end">
                <Button type="submit" disabled={submittingSignature}>
                  {submittingSignature ? (
                    <>
                      <FastSpinner size="sm" className="mr-2" /> Saving…
                    </>
                  ) : (
                    <>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Save signature
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-mono">Saved prompts</CardTitle>
            <Badge variant="secondary">{prompts.length}</Badge>
          </CardHeader>
          <CardContent>{renderList(prompts, "PROMPT")}</CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-mono">Saved signatures</CardTitle>
            <Badge variant="secondary">{signatures.length}</Badge>
          </CardHeader>
          <CardContent>{renderList(signatures, "SIGNATURE")}</CardContent>
        </Card>
      </div>
    </div>
  )
}

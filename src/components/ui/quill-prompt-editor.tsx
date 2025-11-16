"use client"

import { useEffect, useRef } from "react"
import Quill from "quill"
import "quill/dist/quill.snow.css"

type QuillPromptEditorProps = {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  output?: "text" | "html"
}

const TOOLBAR_OPTIONS = [
  [{ size: ["small", false, "large"] }],
  ["bold", "italic"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link"],
  ["clean"],
]

const normalizeUrl = (input: string) => {
  if (!input) return ""
  return /^https?:\/\//i.test(input) ? input : `https://${input}`
}

const sanitizeAnchorHtml = (html: string) => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")
  doc.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? ""
    if (!href) {
      anchor.removeAttribute("href")
      return
    }
    const normalized = normalizeUrl(href)
    anchor.setAttribute("href", normalized)
    anchor.setAttribute("target", "_blank")
    anchor.setAttribute("rel", "noopener noreferrer")
  })
  return doc.body.innerHTML || ""
}

export function QuillPromptEditor({ value, onChange, placeholder, output = "text" }: QuillPromptEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const quillRef = useRef<Quill | null>(null)
  const onChangeRef = useRef(onChange)
  const initialValueRef = useRef(value)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!containerRef.current || quillRef.current) {
      return
    }

    const container = containerRef.current
    container.innerHTML = ""

    const wrapper = document.createElement("div")
    container.appendChild(wrapper)

    const quill = new Quill(wrapper, {
      theme: "snow",
      placeholder,
      modules: {
        toolbar: TOOLBAR_OPTIONS,
        history: {
          delay: 400,
          maxStack: 250,
          userOnly: true,
        },
      },
    })

    quill.root.classList.add("min-h-[160px]", "max-h-64", "overflow-y-auto", "text-sm", "leading-relaxed")
    quill.on("text-change", () => {
      if (output === "html") {
        const html = sanitizeAnchorHtml(quill.root.innerHTML)
        onChangeRef.current(html === "<p><br></p>" ? "" : html)
      } else {
        const next = quill.getText().replace(/\n+$/, "")
        onChangeRef.current(next)
      }
    })

    const initialValue = initialValueRef.current
    if (initialValue) {
      if (output === "html") {
        quill.clipboard.dangerouslyPasteHTML(sanitizeAnchorHtml(initialValue))
      } else {
        quill.setText(initialValue)
      }
    }

    quillRef.current = quill

    return () => {
      quill.off("text-change")
      quillRef.current = null
      container.innerHTML = ""
    }
  }, [output, placeholder])

  useEffect(() => {
    const quill = quillRef.current
    if (!quill) return
    const rawCurrent = output === "html" ? sanitizeAnchorHtml(quill.root.innerHTML) : quill.getText().replace(/\n+$/, "")
    const normalizedCurrent = output === "html" && rawCurrent === "<p><br></p>" ? "" : rawCurrent
    const normalizedValue = output === "html" && value === "<p><br></p>" ? "" : value
    const sanitizedTarget = output === "html" ? sanitizeAnchorHtml(normalizedValue || "") : normalizedValue

    if (normalizedCurrent === sanitizedTarget) {
      return
    }

    const selection = quill.getSelection()
    if (output === "html") {
      quill.clipboard.dangerouslyPasteHTML(sanitizedTarget || "")
    } else {
      quill.setText(value || "")
    }
    const length = quill.getLength()
    if (selection) {
      const index = Math.min(selection.index, length - 1)
      quill.setSelection(index, selection.length, "silent")
    } else {
      quill.setSelection(length - 1, 0, "silent")
    }
  }, [output, value])

  return <div ref={containerRef} className="quill-editor w-full" />
}

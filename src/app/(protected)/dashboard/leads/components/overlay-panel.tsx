"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

type OverlayPanelProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  contentClassName?: string
  showCloseButton?: boolean
}

export function OverlayPanel({
  open,
  onClose,
  children,
  contentClassName,
  showCloseButton = true,
}: OverlayPanelProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return
    }
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [open])

  if (!mounted || !open || typeof document === "undefined") {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm lg:left-64 lg:w-[calc(100%-16rem)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 top-16 flex justify-center px-4 pb-8 pt-6 lg:left-64 lg:w-[calc(100%-16rem)] lg:px-8">
        <div
          className={cn(
            "relative flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition",
            contentClassName,
          )}
        >
          {showCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted/70 text-muted-foreground transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close overlay</span>
            </button>
          ) : null}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}


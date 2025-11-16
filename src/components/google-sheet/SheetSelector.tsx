"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronsUpDown, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { GoogleSpreadsheet } from "@/types/google-sheet"
import { cn } from "@/lib/utils"

interface SheetSelectorProps {
  sheets: GoogleSpreadsheet[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  emptyMessage?: string
  onOpenChange?: (open: boolean) => void
}

export function SheetSelector({
  sheets,
  value,
  onChange,
  placeholder = "Select sheet",
  disabled = false,
  loading = false,
  emptyMessage = "No sheets match your search.",
  onOpenChange,
}: SheetSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selected = sheets.find((sheet) => sheet.id === value)

  const filteredSheets = useMemo(() => {
    if (!search.trim()) {
      return sheets
    }
    const term = search.toLowerCase()
    return sheets.filter((sheet) => sheet.name.toLowerCase().includes(term) || sheet.id.toLowerCase().includes(term))
  }, [search, sheets])

  useEffect(() => {
    if (!open) {
      return
    }
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) {
        return
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setSearch("")
        onOpenChange?.(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) {
      return
    }
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [open, search])

  const toggleOpen = () => {
    if (disabled) {
      return
    }
    setOpen((prev) => {
      const next = !prev
      onOpenChange?.(next)
      if (!next) {
        setSearch("")
      }
      return next
    })
  }

  const handleSelect = (sheetId: string) => {
    onChange(sheetId)
    setOpen(false)
    setSearch("")
    onOpenChange?.(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        className={cn("w-full justify-between", disabled && "opacity-60")}
        onClick={toggleOpen}
        disabled={disabled}
      >
        <span>{selected ? selected.name : loading ? "Loading sheets…" : placeholder}</span>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </Button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full rounded-md border bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sheets..."
              className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-60 overflow-auto py-1">
            {filteredSheets.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              filteredSheets.map((sheet) => (
                <button
                  key={sheet.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted",
                    sheet.id === value ? "text-primary" : "text-foreground",
                  )}
                  onClick={() => handleSelect(sheet.id)}
                >
                  {sheet.name}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

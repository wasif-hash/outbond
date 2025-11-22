"use client"

import { useQuery, type UseQueryOptions } from "@tanstack/react-query"

import { getSavedSnippetsAction } from "@/actions/saved-snippets"
import type { SavedSnippet } from "@/types/saved-snippet"

const SAVED_SNIPPETS_QUERY_KEY = ["savedSnippets"] as const

async function fetchSavedSnippets(): Promise<SavedSnippet[]> {
  return getSavedSnippetsAction()
}

type SavedSnippetsQueryOptions = Omit<UseQueryOptions<SavedSnippet[], Error>, "queryKey" | "queryFn"> & {
  enabled?: boolean
}

export function useSavedSnippets(options: SavedSnippetsQueryOptions = {}) {
  return useQuery<SavedSnippet[], Error>({
    queryKey: SAVED_SNIPPETS_QUERY_KEY,
    queryFn: fetchSavedSnippets,
    staleTime: 1000 * 60 * 60 * 24, // keep for entire session
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    ...options,
  })
}
export { SAVED_SNIPPETS_QUERY_KEY }

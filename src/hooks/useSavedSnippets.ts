import { useQuery, type UseQueryOptions } from "@tanstack/react-query"
import axios from "axios"

import type { SavedSnippet } from "@/types/saved-snippet"

const SAVED_SNIPPETS_QUERY_KEY = ["savedSnippets"] as const

async function fetchSavedSnippets(): Promise<SavedSnippet[]> {
  const response = await axios.get<{ snippets: SavedSnippet[] }>("/api/saved-items")
  return response.data.snippets ?? []
}

type SavedSnippetsQueryOptions = Omit<UseQueryOptions<SavedSnippet[], Error>, "queryKey" | "queryFn"> & {
  enabled?: boolean
}

export function useSavedSnippets(options: SavedSnippetsQueryOptions = {}) {
  return useQuery<SavedSnippet[], Error>({
    queryKey: SAVED_SNIPPETS_QUERY_KEY,
    queryFn: fetchSavedSnippets,
    staleTime: 1000 * 60 * 60 * 24, // keep for entire session
    cacheTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    ...options,
  })
}

export { SAVED_SNIPPETS_QUERY_KEY }

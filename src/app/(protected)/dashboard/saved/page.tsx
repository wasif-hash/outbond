import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"
import { getSavedSnippetsAction } from "@/actions/saved-snippets"

import { SavedClient } from "./saved-client"

export const dynamic = "force-dynamic"

export default async function SavedPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }

  const snippets = await getSavedSnippetsAction()

  return <SavedClient initialSnippets={snippets} />
}

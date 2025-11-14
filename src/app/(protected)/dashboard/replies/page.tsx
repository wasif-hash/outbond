import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"

import { fetchRepliesForUser } from "@/lib/replies"
import { RepliesClient } from "./replies-client"

export const dynamic = "force-dynamic"

export default async function RepliesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const replies = await fetchRepliesForUser(user.userId)

  return <RepliesClient replies={replies} />
}

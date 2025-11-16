import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"

import { DashboardClient } from "./dashboard-client"
import { getDashboardAnalytics } from "@/actions/dashboard"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const analytics = await getDashboardAnalytics()

  return <DashboardClient analytics={analytics} isAdmin={user.role === "admin"} />
}

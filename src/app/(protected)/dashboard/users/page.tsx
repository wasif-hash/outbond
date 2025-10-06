// src/app/dashboard/users/page.tsx

import { prisma } from "@/lib/prisma" // <-- adjust if your prisma helper lives elsewhere
import UsersTable from "./userTable"

// Ensure this route is fully SSR and not cached
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function UsersPage() {
  // Load users on the server for fast initial render
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, createdAt: true },
  })

  return (
    <div className="w-full max-w-none px-6 py-6">
      <h1 className="text-2xl font-semibold mb-4">Users</h1>
      <UsersTable initialUsers={users} />
    </div>
  )
}

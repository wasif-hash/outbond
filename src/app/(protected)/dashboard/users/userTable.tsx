// src/app/dashboard/users/UsersTable.tsx
"use client"

import { useState, useMemo } from "react"
import axios from 'axios'
import { getApiClient } from '@/lib/http-client'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog"
import { toast } from "sonner"

type UserRow = {
  id: string
  email: string
  role: string
  createdAt: string | Date
}

export default function UsersTable({ initialUsers }: { initialUsers: UserRow[] }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const client = useMemo(() => getApiClient(), [])

  const refreshUsers = async () => {
    try {
      const { data } = await client.get<{ users?: UserRow[] }>('/api/users', {
        headers: { 'cache-control': 'no-store' },
      })
      setUsers(data.users || [])
    } catch (err) {
      console.error(err)
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.error as string) || err.message || 'Failed to fetch users'
        : 'Server error while fetching users'
      toast.error(message)
    }
  }

  const handleInvite = async () => {
    setLoading(true)
    try {
      await client.post('/api/invite-users', { email, password })

      toast.success('User invited successfully')
      setEmail('')
      setPassword('')
      setDialogOpen(false)
      await refreshUsers()
    } catch (err) {
      console.error(err)
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.error as string) || err.message || 'Failed to invite user'
        : 'Server error'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await client.delete(`/api/users/${id}`)
      toast.success('User removed successfully')
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch (err) {
      console.error(err)
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.error as string) || err.message || 'Failed to remove user'
        : 'Server error'
      toast.error(message)
    }
  }

  return (
    <div className="w-full">
      {/* Invite Panel */}
      <div className="w-full p-6 bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 rounded-2xl mb-6">
        <h2 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-neutral-100">
          Invite New User
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              placeholder="Enter user email"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              placeholder="Set initial password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-primary text-white hover:bg-primary/80"
                disabled={!email || !password}
              >
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Action</DialogTitle>
              </DialogHeader>
              <p>
                Are you sure you want to add this user with email <b>{email}</b>?
              </p>
              <DialogFooter className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleInvite}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Confirm"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Users Table: full-width */}
      <div className="w-full bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">All Users</h3>
            <Button variant="outline" size="sm" onClick={refreshUsers}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="p-3 text-left font-medium">Email</th>
                <th className="p-3 text-left font-medium">Role</th>
                <th className="p-3 text-left font-medium">Added</th>
                <th className="p-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-neutral-200/70 dark:border-neutral-800/70"
                  >
                    <td className="p-3">{user.email}</td>
                    <td className="p-3 capitalize">{user.role}</td>
                    <td className="p-3">
                      {new Date(user.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemove(user.id)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-6 text-center text-neutral-500" colSpan={4}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
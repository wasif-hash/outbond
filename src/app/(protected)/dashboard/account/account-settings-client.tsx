"use client"

import { useState, useTransition, type ChangeEvent, type FormEvent } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Eye, EyeOff, ShieldCheck, Loader2, LockKeyhole, Mail, PlugZap } from 'lucide-react'

import type { AuthUser } from '@/lib/auth'
import { useGmail } from '@/hooks/useGmail'
import { cn } from '@/lib/utils'
import { changePasswordAction } from '@/actions/auth'

const GmailConnectPanel = dynamic(
  () => import('@/components/gmail/GmailConnectPanel').then((mod) => ({ default: mod.GmailConnectPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading Gmail…
      </div>
    )
  }
)

type AccountSettingsClientProps = {
  user: AuthUser
  googleSheetsStatus: GoogleSheetsStatus | null
}

type PasswordFormState = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const initialPasswordFormState: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
}

type GoogleSheetsStatus = {
  isConnected: boolean
  isExpired: boolean
  connectedAt: string | null
  expiresAt: string | null
}

export function AccountSettingsClient({ user, googleSheetsStatus }: AccountSettingsClientProps) {
  const [formState, setFormState] = useState<PasswordFormState>(initialPasswordFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false
  })
  const [, startTransition] = useTransition()
  const { status: gmailStatus, statusLoading: gmailStatusLoading } = useGmail()

  const handlePasswordChange = (field: keyof PasswordFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.currentPassword || !formState.newPassword || !formState.confirmPassword) {
      toast.error('Please complete all password fields.')
      return
    }

    if (formState.newPassword !== formState.confirmPassword) {
      toast.error('New passwords do not match.')
      return
    }

    setIsSubmitting(true)
    startTransition(() => {
      changePasswordAction({
        currentPassword: formState.currentPassword,
        newPassword: formState.newPassword,
        confirmPassword: formState.confirmPassword,
      })
        .then((result) => {
          toast.success(result.message)
          setFormState(initialPasswordFormState)
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Unable to update password.'
          toast.error(message)
        })
        .finally(() => {
          setIsSubmitting(false)
        })
    })
  }

  const gmailConnectionLabel = gmailStatus?.isConnected
    ? `Connected as ${gmailStatus.emailAddress ?? 'your Gmail account'}`
    : 'No Gmail account connected'

  const googleSheetsConnectionLabel = googleSheetsStatus?.isConnected
    ? 'Google Sheets integration is active'
    : 'No Google Sheets integration connected'

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-mono font-bold text-foreground">Account Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, update your password, and review connected integrations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg font-mono">Profile</CardTitle>
            </div>
            <CardDescription>Basic information tied to your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account-email">Email</Label>
              <Input id="account-email" value={user.email} readOnly className="bg-muted/60" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Badge variant="secondary" className="font-mono">
                {user.role}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg font-mono">Change Password</CardTitle>
            </div>
            <CardDescription>
              Choose a strong password with at least 8 characters to keep your account secure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showPassword.current ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={formState.currentPassword}
                    onChange={handlePasswordChange('currentPassword')}
                    disabled={isSubmitting}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setShowPassword((prev) => ({ ...prev, current: !prev.current }))
                    }
                    disabled={isSubmitting}
                    aria-label={showPassword.current ? 'Hide current password' : 'Show current password'}
                  >
                    {showPassword.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword.next ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={formState.newPassword}
                    onChange={handlePasswordChange('newPassword')}
                    disabled={isSubmitting}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setShowPassword((prev) => ({ ...prev, next: !prev.next }))
                    }
                    disabled={isSubmitting}
                    aria-label={showPassword.next ? 'Hide new password' : 'Show new password'}
                  >
                    {showPassword.next ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showPassword.confirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={formState.confirmPassword}
                    onChange={handlePasswordChange('confirmPassword')}
                    disabled={isSubmitting}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))
                    }
                    disabled={isSubmitting}
                    aria-label={showPassword.confirm ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showPassword.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating password…
                  </>
                ) : (
                  'Update password'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <PlugZap className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg font-mono">Connected Accounts</CardTitle>
          </div>
          <CardDescription>Review and manage integrations linked to your Outbond account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">Google Sheets</h3>
                  <p className="text-sm text-muted-foreground">
                    Sync campaign data with connected spreadsheets.
                  </p>
                </div>
                <ShieldCheck
                  className={cn(
                    "h-5 w-5",
                    googleSheetsStatus?.isConnected ? "text-emerald-500" : "text-muted-foreground"
                  )}
                />
              </div>

              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={googleSheetsStatus?.isConnected ? 'positive' : 'secondary'}
                    className={cn(
                      'flex items-center gap-1',
                      googleSheetsStatus?.isConnected ? 'bg-emerald-500 text-white border-transparent hover:bg-emerald-500/90' : ''
                    )}
                  >
                    {googleSheetsStatus?.isConnected ? 'Connected' : 'Not Connected'}
                  </Badge>
                  <span>{googleSheetsConnectionLabel}</span>
                </div>
                {googleSheetsStatus?.connectedAt ? (
                  <span className="text-xs text-muted-foreground">
                    Connected on {new Date(googleSheetsStatus.connectedAt).toLocaleString()}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {googleSheetsStatus?.isConnected ? 'Connection active' : 'No sheet connected'}
                  </span>
                )}
                {googleSheetsStatus?.isExpired && (
                  <span className="text-xs text-destructive">Connection expired. Please reconnect.</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-primary/40 text-primary hover:bg-primary/10"
                >
                  <Link href="/dashboard/settings">Manage integration</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Gmail</h3>
                  <p className="text-sm text-muted-foreground">{gmailConnectionLabel}</p>
                </div>
                {gmailStatusLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : gmailStatus?.isConnected ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="rounded-md border border-dashed border-muted-foreground/40 p-3">
                <GmailConnectPanel />
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-border" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Need advanced integration controls? Visit the integrations dashboard.
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard/settings">Open integrations</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

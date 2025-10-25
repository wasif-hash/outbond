'use client'

import { Mail, RefreshCw, LinkIcon, Unlink, CheckCircle2, XCircle, Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useGmail } from '@/hooks/useGmail'

const formatTimestamp = (timestamp: number | string | Date | null | undefined) => {
  if (timestamp === null || timestamp === undefined) return null
  let value: number | null = null
  if (typeof timestamp === 'number') {
    value = timestamp
  } else if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp)
    value = Number.isNaN(parsed) ? null : parsed
  } else if (timestamp instanceof Date) {
    value = timestamp.getTime()
  }
  if (value === null) return null
  try {
    return new Date(value).toLocaleString()
  } catch {
    return null
  }
}

export function GmailConnectPanel() {
  const {
    status,
    loading,
    statusLoading,
    error,
    setError,
    connect,
    disconnect,
    refreshStatus,
    lastFetched,
  } = useGmail()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-mono font-bold text-foreground">Gmail Integration</h2>
          <p className="text-muted-foreground">Send personalised outreach emails directly from your connected Gmail inbox.</p>
        </div>
        <Mail className="h-10 w-10 text-primary" />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Status</div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  status?.isConnected ? 'positive' : status?.requiresReauth ? 'secondary' : 'neutral'
                }
                className={`flex items-center gap-1 ${
                  status?.isConnected ? 'bg-emerald-500 text-white border-transparent hover:bg-emerald-500/90' : ''
                }`}
              >
                {status?.isConnected ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : status?.requiresReauth ? (
                  <Clock className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {status?.isConnected ? 'Connected' : status?.requiresReauth ? 'Reconnect soon' : 'Not Connected'}
              </Badge>
              {status?.emailAddress && (
                <span className="text-sm font-mono text-muted-foreground">{status.emailAddress}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refreshStatus().catch(() => undefined)
              }}
              disabled={loading || statusLoading}
            >
              {statusLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {statusLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
            {status?.isConnected ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={disconnect}
                disabled={loading}
              >
                <Unlink className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={connect}
                disabled={loading}
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Connect Gmail
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-1 text-sm text-muted-foreground">
          {status?.isConnected && status.expiresAt && (
            <div>
              Refresh token renews automatically before <span className="font-medium">{new Date(status.expiresAt).toLocaleString()}</span>.
            </div>
          )}
          {status?.isConnected && status.lastActiveAt && (
            <div>
              Connection refreshed <span className="font-medium">{formatTimestamp(status.lastActiveAt)}</span>.
            </div>
          )}
          {formatTimestamp(lastFetched) && (
            <div>
              Last checked <span className="font-medium">{formatTimestamp(lastFetched)}</span>.
            </div>
          )}
          {status?.inactiveSince && !status.isConnected && (
            <div>
              Connection paused since <span className="font-medium">{formatTimestamp(status.inactiveSince)}</span>. Reconnect to resume sending.
            </div>
          )}
        </div>
      </div>

      {status?.requiresReauth && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          We paused sending because this Gmail account has been inactive for a few days. Reconnect to resume outreach.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h3 className="font-mono text-sm font-semibold text-foreground mb-2">Why connect Gmail?</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Send outreach directly from your own inbox to stay authentic.</li>
            <li>Respect Gmail rate limits with automatic pacing.</li>
            <li>Track send history and status per lead.</li>
          </ul>
        </div>
        <div className="rounded-lg border border-border p-4">
          <h3 className="font-mono text-sm font-semibold text-foreground mb-2">Security</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>OAuth 2.0 secure handshake, we never store your password.</li>
            <li>Tokens encrypted at rest and refresh automatically.</li>
            <li>Disconnect at any time to revoke access.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export interface GmailConnectionStatus {
  isConnected: boolean
  emailAddress: string | null
  expiresAt: string | null
  willRefresh: boolean
  requiresReauth?: boolean
  lastActiveAt?: string | Date | null
  inactiveSince?: string | Date | null
}

export interface GmailConnectionStatus {
  isConnected: boolean
  emailAddress: string | null
  expiresAt: string | null
  willRefresh: boolean
}

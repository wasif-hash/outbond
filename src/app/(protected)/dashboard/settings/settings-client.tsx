"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { CheckCircle, Clock, ExternalLink, XCircle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useGmail } from "@/hooks/useGmail"

const GoogleSheetButton = dynamic(() => import("@/components/GoogleSheetButton"), {
  ssr: false,
  loading: () => (
    <Button variant="outline" disabled>
      Loading Google Sheets…
    </Button>
  ),
})

const GmailConnectPanel = dynamic(
  () => import("@/components/gmail/GmailConnectPanel").then((mod) => ({ default: mod.GmailConnectPanel })),
  {
    ssr: false,
    loading: () => (
      <Button variant="outline" disabled>
        Loading Gmail…
      </Button>
    ),
  },
)

type Integration = {
  id: string
  name: string
  description: string
  status: "connected" | "pending" | "coming-soon"
  icon: string
  configurable: boolean
}

const INTEGRATIONS: Integration[] = [
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Sync leads and data with Google Sheets",
    status: "connected",
    icon: "📊",
    configurable: true,
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Send personalised outreach directly from your inbox",
    status: "pending",
    icon: "✉️",
    configurable: true,
  },
]

const suppressionList = [
  {
    value: "competitor@rival.com",
    reason: "Competitor",
    addedAt: "Aug 24, 2024",
    source: "Manual",
  },
  {
    value: "spam.email@invalid.com",
    reason: "Invalid Email",
    addedAt: "Aug 23, 2024",
    source: "Bounce",
  },
  {
    value: "@blacklisted-domain.com",
    reason: "Domain Block",
    addedAt: "Aug 22, 2024",
    source: "Manual",
  },
]

export function SettingsClient() {
  const [activeIntegration, setActiveIntegration] = useState<string | null>(null)
  const [hasMounted, setHasMounted] = useState(false)
  const { status: gmailStatus, statusLoading: gmailStatusLoading } = useGmail()

  useEffect(() => {
    setHasMounted(true)
  }, [])

  const integrations = useMemo(() => {
    return INTEGRATIONS.map((integration) => {
      if (integration.id === "gmail") {
        const isConnected = gmailStatus?.isConnected
        const nextStatus: Integration["status"] = isConnected ? "connected" : "pending"
        return {
          ...integration,
          status: gmailStatusLoading && !isConnected ? "pending" : nextStatus,
        }
      }
      return integration
    })
  }, [gmailStatus?.isConnected, gmailStatusLoading])

  const handleIntegrationConfig = (integrationId: string) => {
    setActiveIntegration(integrationId)
  }

  const handleBackToIntegrations = () => {
    setActiveIntegration(null)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-mono font-bold text-foreground">Settings</h1>
        <p className="text-muted-text mt-1">Configure integrations and system preferences</p>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-6">
          {activeIntegration ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-mono">
                      {activeIntegration === "google-sheets" && "Google Sheets Integration"}
                      {activeIntegration === "gmail" && "Gmail Integration"}
                      {activeIntegration !== "google-sheets" && activeIntegration !== "gmail" && "Integration Settings"}
                    </CardTitle>
                    <p className="text-muted-text mt-1">
                      {activeIntegration === "google-sheets" && "Connect and manage your Google Sheets"}
                      {activeIntegration === "gmail" && "Connect Gmail to send personalised outreach"}
                      {activeIntegration !== "google-sheets" && activeIntegration !== "gmail" && "Manage integration settings"}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleBackToIntegrations}>
                    ← Back to Integrations
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {hasMounted && activeIntegration === "google-sheets" && <GoogleSheetButton />}
                {hasMounted && activeIntegration === "gmail" && <GmailConnectPanel />}
                {hasMounted && activeIntegration !== "google-sheets" && activeIntegration !== "gmail" && (
                  <div className="text-sm text-muted-foreground">Configuration for this integration is coming soon.</div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-mono">Connected Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {integrations.map((integration) => (
                    <div key={integration.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{integration.icon}</span>
                          <div>
                            <h3 className="font-medium">{integration.name}</h3>
                            <p className="text-sm text-muted-text">{integration.description}</p>
                            {integration.id === "gmail" && gmailStatus?.emailAddress && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Connected as <span className="font-mono">{gmailStatus.emailAddress}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={
                            integration.status === "connected"
                              ? "positive"
                              : integration.status === "pending"
                                ? "secondary"
                                : "neutral"
                          }
                          className={`flex items-center gap-1 ${
                            integration.status === "connected"
                              ? "bg-emerald-500 text-white border-transparent hover:bg-emerald-500/90"
                              : " bg-yellow-500"
                          }`}
                        >
                          {integration.status === "connected" ? (
                            <CheckCircle className="h-3.5 w-3.5" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                          {integration.status === "connected"
                            ? "Connected"
                            : integration.status === "pending"
                              ? "Pending"
                              : "Soon"}
                        </Badge>
                      </div>
                     
                      {integration.configurable && (
                        <Button className="mt-4 w-full" variant="outline" onClick={() => handleIntegrationConfig(integration.id)}>
                          Configure
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-mono">Suppression List</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {suppressionList.map((entry) => (
                <div key={entry.value} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <div className="font-medium text-sm text-foreground">{entry.value}</div>
                    <div className="text-xs text-muted-text">
                      {entry.reason} • Added {entry.addedAt} • {entry.source}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost">
                    Remove
                  </Button>
                </div>
              ))}
              <Button variant="outline">Upload suppression CSV</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-mono">Alert Routing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-text">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <span>Send positive replies to founders@company.com</span>
              </div>
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-destructive" />
                <span>Pause campaigns automatically after 3 unsubscribes in 24h</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-500" />
                <span>Daily deliverability summary arrives at 7:00am local time</span>
              </div>
              <Button variant="outline">Manage alert policy</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

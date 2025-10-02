"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";

// ⬇️ Load the GoogleSheetButton only on the client to avoid SSR/hydration loops inside it
const GoogleSheetButton = dynamic(
  () => import("@/components/GoogleSheetButton"),
  {
    ssr: false,
    loading: () => (
      <Button variant="outline" disabled>
        Loading Google Sheets…
      </Button>
    ),
  }
);

type Integration = {
  id: string;
  name: string;
  description: string;
  status: "connected" | "pending" | "coming-soon";
  icon: string;
  configurable: boolean;
};

const INTEGRATIONS: Integration[] = [
  {
    name: "Google Sheets",
    description: "Sync leads and data with Google Sheets",
    status: "connected",
    icon: "📊",
    configurable: true,
    id: "google-sheets",
  },
  
];

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
];

export default function Settings() {
  const [activeIntegration, setActiveIntegration] = useState<string | null>(
    null
  );
  const [hasMounted, setHasMounted] = useState(false);

  // Guard to ensure we only render client-only widgets after hydration
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Memoized integrations to avoid accidental re-renders from identity changes
  const integrations = useMemo(() => INTEGRATIONS, []);

  const handleIntegrationConfig = (integrationId: string) => {
    if (integrationId === "google-sheets") {
      setActiveIntegration(integrationId);
    } else {
      setActiveIntegration(integrationId);
    }
  };

  const handleBackToIntegrations = () => {
    setActiveIntegration(null);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-mono font-bold text-foreground">
          Settings
        </h1>
        <p className="text-muted-text mt-1">
          Configure integrations and system preferences
        </p>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-6">
          {activeIntegration === "google-sheets" ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-mono">
                      Google Sheets Integration
                    </CardTitle>
                    <p className="text-muted-text mt-1">
                      Connect and manage your Google Sheets
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBackToIntegrations}
                  >
                    ← Back to Integrations
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Only render the client-only button after hydration to avoid render loops */}

                {hasMounted ? <GoogleSheetButton /> : null}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-mono">
                  Connected Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {integrations.map((integration) => (
                    <div
                      key={integration.id}
                      className="p-4 border border-border rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">
                            {integration.icon}
                          </span>
                          <div>
                            <h3 className="font-medium">{integration.name}</h3>
                            <p className="text-sm text-muted-text">
                              {integration.description}
                            </p>
                          </div>
                        </div>

                        {integration.status === "connected" && (
                          <CheckCircle className="h-5 w-5 text-status-positive" />
                        )}
                        {integration.status === "pending" && (
                          <Clock className="h-5 w-5 text-status-neutral" />
                        )}
                        {integration.status === "coming-soon" && (
                          <XCircle className="h-5 w-5 text-status-negative" />
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <Badge
                          variant={
                            integration.status === "connected"
                              ? "positive"
                              : integration.status === "pending"
                              ? "neutral"
                              : "negative"
                          }
                        >
                          {integration.status === "connected"
                            ? "Connected"
                            : integration.status === "pending"
                            ? "Pending"
                            : "Coming Soon"}
                        </Badge>

                        <Button
                          variant={
                            integration.configurable ? "outline" : "ghost"
                          }
                          size="sm"
                          disabled={!integration.configurable}
                          onClick={() =>
                            integration.configurable &&
                            handleIntegrationConfig(integration.id)
                          }
                        >
                          {integration.configurable
                            ? "Configure"
                            : "Unavailable"}
                          {integration.configurable && (
                            <ExternalLink className="h-4 w-4 ml-2" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-mono">
                  Suppression List
                </CardTitle>
                <Button variant="plum" size="sm">
                  Add Suppression
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 font-mono font-bold text-sm">
                        Value
                      </th>
                      <th className="text-left py-3 font-mono font-bold text-sm">
                        Reason
                      </th>
                      <th className="text-left py-3 font-mono font-bold text-sm">
                        Added At
                      </th>
                      <th className="text-left py-3 font-mono font-bold text-sm">
                        Source
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppressionList.map((item, index) => (
                      <tr
                        key={index}
                        className="border-b border-border hover:bg-muted-bg transition-colors"
                      >
                        <td className="py-3 font-mono text-sm">{item.value}</td>
                        <td className="py-3">
                          <Badge variant="outline" className="text-xs">
                            {item.reason}
                          </Badge>
                        </td>
                        <td className="py-3 text-muted-text font-mono text-sm">
                          {item.addedAt}
                        </td>
                        <td className="py-3 text-muted-text">{item.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-mono">Slack Digest</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Mock Slack Preview */}
              <div className="p-4 bg-muted-bg rounded-lg border-l-4 border-electric-blue">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-electric-blue rounded flex items-center justify-center mr-3">
                    <span className="text-white text-sm font-bold">CWT</span>
                  </div>
                  <div>
                    <div className="font-medium">CWT Studio Daily Digest</div>
                    <div className="text-sm text-muted-text">
                      Today at 9:00 AM
                    </div>
                  </div>
                </div>
                <div className="text-sm space-y-2">
                  <div>
                    📊 <strong>23 emails sent</strong> across 3 campaigns
                  </div>
                  <div>
                    💬 <strong>8 replies received</strong> (5 positive, 2
                    neutral, 1 negative)
                  </div>
                  <div>
                    📅 <strong>2 bookings confirmed</strong> for this week
                  </div>
                  <div>
                    ⚠️ <strong>2 errors</strong> require attention
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Schedule
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (day) => (
                        <Button
                          key={day}
                          variant={
                            ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(day)
                              ? "plum"
                              : "outline"
                          }
                          size="sm"
                          className="h-8"
                        >
                          {day}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Time</label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      09:00
                    </Button>
                    <span className="text-muted-text">daily</span>
                  </div>
                </div>

                <Button variant="plum">Save Digest Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

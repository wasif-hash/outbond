import type { ReactNode } from "react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"
import { formatRelativeTime } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ManualCampaignEmailsTable } from "../components/manual-campaign-emails-table"
import { getManualOutreachCampaignDetailAction } from "@/actions/manual-outreach-campaigns"

export const dynamic = "force-dynamic"

type ManualOutreachCampaignPageProps = {
  params: Promise<{ campaignId: string }>
}

const resolveSourceLabel = (source: string | null) => {
  if (source === "google-sheet") return "Google Sheet"
  if (source === "file-upload") return "File upload"
  return "Unknown source"
}

const formatTimestamp = (value: string | null) => {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default async function ManualOutreachCampaignPage({ params }: ManualOutreachCampaignPageProps) {
  const { campaignId } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const detail = await getManualOutreachCampaignDetailAction(campaignId, user.userId)

  if (!detail) {
    notFound()
  }

  const { campaign, metrics, emails } = detail
  const sourceLabel = resolveSourceLabel(campaign.source)

  const metricItems = [
    { label: "Total emails", value: metrics.totalEmails },
    { label: "Sent", value: metrics.sent },
    { label: "Draft / queued", value: metrics.drafts },
    { label: "Queued", value: metrics.queued },
    { label: "Pending", value: metrics.pending },
    { label: "Sending", value: metrics.sending },
    { label: "Failed", value: metrics.failed },
    { label: "Cancelled", value: metrics.cancelled },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-mono font-bold text-foreground">{campaign.name}</h1>
            <Badge variant="outline" className="font-mono text-xs uppercase">
              {campaign.totalEmails} emails
            </Badge>
            <Badge variant="outline" className="text-xs uppercase">
              {sourceLabel}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Created {campaign.createdAt ? formatRelativeTime(new Date(campaign.createdAt)) : "—"}
            {campaign.updatedAt ? ` · Updated ${formatRelativeTime(new Date(campaign.updatedAt))}` : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/outreach">← Back to Outreach</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase text-muted-foreground">Campaign summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <SummaryRow label="Campaign ID" value={<code>{campaign.id}</code>} />
            <SummaryRow label="Source" value={sourceLabel} />
            <SummaryRow label="First email" value={formatTimestamp(campaign.firstSentAt)} />
            <SummaryRow label="Last email" value={formatTimestamp(campaign.lastSentAt)} />
            <SummaryRow label="Total emails" value={campaign.totalEmails.toLocaleString()} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase text-muted-foreground">Delivery metrics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {metricItems.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-xs uppercase text-muted-foreground">{metric.label}</p>
                <p className="text-2xl font-mono font-bold text-foreground">{metric.value.toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-sm uppercase text-muted-foreground">Email activity</CardTitle>
          <p className="text-sm text-muted-foreground">
            Showing the latest {emails.length} email{emails.length === 1 ? "" : "s"} for this campaign.
          </p>
        </CardHeader>
        <CardContent>
          <ManualCampaignEmailsTable emails={emails} />
        </CardContent>
      </Card>
    </div>
  )
}

const SummaryRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium text-foreground">{value}</span>
  </div>
)

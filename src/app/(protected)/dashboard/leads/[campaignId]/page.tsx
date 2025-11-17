import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"
import { getCampaignDetailAction } from "@/actions/campaigns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CampaignStatusBadge } from "@/components/campaigns/CampaignStatusBadge"
import { CampaignProgressIndicator } from "@/components/campaigns/CampaignProgressIndicator"
import { formatRelativeTime } from "@/lib/utils"

type CampaignDetailPageProps = {
  params: Promise<{ campaignId: string }>
}

export const dynamic = "force-dynamic"

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { campaignId } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const detail = await getCampaignDetailAction(campaignId, user.userId)
  if (!detail) {
    notFound()
  }

  const { campaign, latestJob, metrics } = detail
  const googleSheetUrl = `https://docs.google.com/spreadsheets/d/${campaign.googleSheet.spreadsheetId}`

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-mono font-bold text-foreground">{campaign.name}</h1>
            <CampaignStatusBadge status={latestJob?.status || "PENDING"} />
            {!campaign.isActive && (
              <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                Paused
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Created {formatRelativeTime(new Date(campaign.createdAt))} · Last updated{" "}
            {formatRelativeTime(new Date(campaign.updatedAt))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/dashboard/leads">← Back to Leads</Link>
          </Button>
          <Button asChild>
            <a href={googleSheetUrl} target="_blank" rel="noopener noreferrer">
              Open Google Sheet
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase text-muted-foreground">Campaign configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target roles</span>
              <span className="font-medium text-right">{campaign.nicheOrJobTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Locations</span>
              <span className="font-medium text-right">{campaign.location}</span>
            </div>
            {campaign.keywords && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Keywords</span>
                <span className="max-w-[240px] text-right font-medium">{campaign.keywords}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Search mode</span>
              <span className="font-medium">
                {campaign.searchMode === "conserve" ? "Credit saver" : "Balanced"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max leads</span>
              <span className="font-medium">{campaign.maxLeads.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Leads per batch</span>
              <span className="font-medium">{campaign.pageSize}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Google Sheet</span>
              <span className="font-medium">{campaign.googleSheet.title}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase text-muted-foreground">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CampaignProgressIndicator
              current={
                latestJob?.status === "SUCCEEDED"
                  ? campaign.maxLeads
                  : latestJob?.leadsProcessed ?? metrics.leadsProcessed
              }
              total={campaign.maxLeads}
              status={latestJob?.status || "PENDING"}
            />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Processed</p>
                <p className="font-mono text-lg font-semibold">{metrics.leadsProcessed.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Written</p>
                <p className="font-mono text-lg font-semibold">{metrics.leadsWritten.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total leads</p>
                <p className="font-mono text-lg font-semibold">{metrics.totalLeads.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ready for outreach</p>
                <p className="font-mono text-lg font-semibold">{metrics.readyForOutreach.toLocaleString()}</p>
              </div>
            </div>
            {latestJob?.lastError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-medium">Last error</p>
                <p className="mt-1 leading-relaxed">{latestJob.lastError}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-sm uppercase text-muted-foreground">Lead quality</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric value={metrics.leadsWithEmail} label="With email" />
          <Metric value={metrics.leadsWithoutEmail} label="Missing email" />
          <Metric value={metrics.invalidLeads} label="Marked invalid" />
          <Metric value={metrics.suppressedLeads} label="Suppressed" />
        </CardContent>
      </Card>

      {latestJob && (
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase text-muted-foreground">Latest pull</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Started</span>
              <span className="font-medium">
                {latestJob.startedAt ? formatRelativeTime(new Date(latestJob.startedAt)) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Finished</span>
              <span className="font-medium">
                {latestJob.finishedAt ? formatRelativeTime(new Date(latestJob.finishedAt)) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pages scraped</span>
              <span className="font-medium">{latestJob.totalPages}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Attempts</span>
              <span className="font-medium">{latestJob.attemptCount}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const Metric = ({ value, label }: { value: number; label: string }) => (
  <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center">
    <p className="text-xs uppercase text-muted-foreground">{label}</p>
    <p className="text-2xl font-mono font-bold text-foreground">{value.toLocaleString()}</p>
  </div>
)

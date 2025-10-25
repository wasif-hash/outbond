export function CampaignsSkeleton() {
  const placeholderRows = Array.from({ length: 4 })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <div className="h-8 w-40 animate-pulse rounded bg-muted/60" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted/50" />
        </div>
        <div className="flex gap-3">
          <div className="h-9 w-28 animate-pulse rounded bg-muted/50" />
          <div className="h-9 w-36 animate-pulse rounded bg-muted/50" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
        <div className="hidden bg-muted/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_auto]" />
        <div className="divide-y divide-border/60">
          {placeholderRows.map((_, index) => (
            <div
              key={index}
              className="grid gap-4 px-4 py-5 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_auto]"
            >
              <div className="space-y-3">
                <div className="h-4 w-48 animate-pulse rounded bg-muted/50" />
                <div className="h-3 w-full max-w-sm animate-pulse rounded bg-muted/40" />
                <div className="h-3 w-32 animate-pulse rounded bg-muted/30" />
              </div>

              <div className="space-y-3">
                <div className="h-3 w-40 animate-pulse rounded bg-muted/40" />
                <div className="h-3 w-56 animate-pulse rounded bg-muted/40" />
              </div>

              <div className="space-y-3">
                <div className="h-3 w-36 animate-pulse rounded bg-muted/40" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted/40" />
              </div>

              <div className="ml-auto flex flex-row gap-2 md:items-center">
                <div className="h-8 w-20 animate-pulse rounded bg-muted/40" />
                <div className="h-8 w-20 animate-pulse rounded bg-muted/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

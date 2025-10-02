// src/components/CampaignProgressIndicator.tsx
import { Progress } from '../ui/progress'
import { cn } from '@/lib/utils'

interface CampaignProgressIndicatorProps {
  current: number
  total: number
  status: string
  className?: string
}

export function CampaignProgressIndicator({
  current,
  total,
  status,
  className,
}: CampaignProgressIndicatorProps) {
  const safeTotal = total > 0 ? total : 1
  const percentage = Math.min(100, Math.max(0, (current / safeTotal) * 100))

  const indicatorClass = (() => {
    switch (status?.toUpperCase()) {
      case 'RUNNING':
        return 'bg-blue-500'
      case 'SUCCEEDED':
        return 'bg-emerald-500'
      case 'FAILED':
        return 'bg-red-500'
      case 'RATE_LIMITED':
        return 'bg-amber-500'
      default:
        return 'bg-muted-foreground'
    }
  })()

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Progress</span>
        <span>{Math.round(percentage)}%</span>
      </div>
      <Progress value={percentage} className="h-1.5" indicatorClassName={indicatorClass} />
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{current.toLocaleString()} leads</span>
        <span>Goal {total.toLocaleString()}</span>
      </div>
    </div>
  )
}

// src/components/CampaignMetrics.tsx
interface CampaignMetricsProps {
  totalLeads: number
  leadsProcessed?: number
  leadsWritten?: number
  totalPages?: number
  status?: string
}

export function CampaignMetrics({ 
  totalLeads, 
  leadsProcessed = 0, 
  leadsWritten = 0,
  totalPages = 0,
  status 
}: CampaignMetricsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <div>
        <div className="text-muted-foreground">Total Leads</div>
        <div className="font-mono font-bold text-lg">{totalLeads}</div>
      </div>
      
      {status === 'RUNNING' && (
        <>
          <div>
            <div className="text-muted-foreground">Processed</div>
            <div className="font-mono font-bold text-lg">{leadsProcessed}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Written</div>
            <div className="font-mono font-bold text-lg">{leadsWritten}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Pages</div>
            <div className="font-mono font-bold text-lg">{totalPages}</div>
          </div>
        </>
      )}
    </div>
  )
}

// src/components/CampaignProgressIndicator.tsx
import { Progress } from '../ui/progress'

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
  className 
}: CampaignProgressIndicatorProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0
  
  const getProgressColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'RUNNING':
        return 'bg-blue-500'
      case 'SUCCEEDED':
        return 'bg-green-500'
      case 'FAILED':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  return (
    <div className={className}>
      <div className="flex justify-between text-sm text-muted-foreground mb-1">
        <span>Progress</span>
        <span>{current} / {total}</span>
      </div>
      <Progress value={percentage} className="h-2" />
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


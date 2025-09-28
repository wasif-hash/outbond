// src/components/CampaignActions.tsx
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Play, Pause, RotateCcw, Trash2, ExternalLink } from 'lucide-react'

interface CampaignActionsProps {
  campaign: {
    id: string
    name: string
    isActive: boolean
    googleSheet: {
      title: string
      spreadsheetId: string
    }
  }
  latestJobStatus?: string
  onToggleActive: (campaignId: string, isActive: boolean) => void
  onRetry: (campaignId: string) => void
  onDelete: (campaignId: string) => void
  disabled?: boolean
}

export function CampaignActions({
  campaign,
  latestJobStatus,
  onToggleActive,
  onRetry,
  onDelete,
  disabled = false
}: CampaignActionsProps) {
  const canRetry = latestJobStatus === 'FAILED' || latestJobStatus === 'CANCELLED'
  const isRunning = latestJobStatus === 'RUNNING' || latestJobStatus === 'PENDING'
  
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${campaign.googleSheet.spreadsheetId}`

  return (
    <div className="flex items-center gap-2">
      {/* Delete button - more prominent */}
      {!isRunning && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(campaign.id)}
          disabled={disabled}
          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      )}
      
      {/* Other actions in dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={disabled}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={() => window.open(spreadsheetUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Google Sheet
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {!isRunning && (
            <DropdownMenuItem
              onClick={() => onToggleActive(campaign.id, !campaign.isActive)}
            >
              {campaign.isActive ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Campaign
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Activate Campaign
                </>
              )}
            </DropdownMenuItem>
          )}
          
          {canRetry && (
            <DropdownMenuItem onClick={() => onRetry(campaign.id)}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
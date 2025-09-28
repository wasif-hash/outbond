// src/components/CampaignStatusBadge.tsx
import { Badge } from '@/components/ui/badge'
import { formatCampaignStatus } from '@/lib/utils'

interface CampaignStatusBadgeProps {
  status: string
  className?: string
}

export function CampaignStatusBadge({ status, className }: CampaignStatusBadgeProps) {
  const { label, variant } = formatCampaignStatus(status)
  
  return (
    <Badge variant={variant as any} className={className}>
      {label}
    </Badge>
  )
}


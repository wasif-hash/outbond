// src/components/CampaignStatusBadge.tsx
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { formatCampaignStatus } from '@/lib/utils'

interface CampaignStatusBadgeProps {
  status: string
  className?: string
}

const allowedVariants: ReadonlyArray<NonNullable<BadgeProps['variant']>> = [
  'default',
  'secondary',
  'destructive',
  'outline',
  'new',
  'queued',
  'outreach',
  'positive',
  'neutral',
  'negative',
  'unsub',
  'bounce',
]

const toBadgeVariant = (variant: string): NonNullable<BadgeProps['variant']> => {
  return allowedVariants.includes(variant as NonNullable<BadgeProps['variant']>)
    ? (variant as NonNullable<BadgeProps['variant']>)
    : 'neutral'
}

export function CampaignStatusBadge({ status, className }: CampaignStatusBadgeProps) {
  const { label, variant } = formatCampaignStatus(status)
  const badgeVariant = toBadgeVariant(variant)
  
  return (
    <Badge variant={badgeVariant} className={className}>
      {label}
    </Badge>
  )
}

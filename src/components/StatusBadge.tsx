import { Badge, type BadgeProps } from "@/components/ui/badge"

interface StatusBadgeProps {
  status: 'new' | 'queued' | 'outreaching' | 'positive' | 'neutral' | 'not interested' | 'unsub' | 'bounced'
  children: React.ReactNode
}

const statusVariantMap: Record<StatusBadgeProps['status'], NonNullable<BadgeProps['variant']>> = {
  new: 'new',
  queued: 'queued',
  outreaching: 'outreach',
  positive: 'positive',
  neutral: 'neutral',
  'not interested': 'negative',
  unsub: 'unsub',
  bounced: 'bounce',
}

export function StatusBadge({ status, children }: StatusBadgeProps) {
  const variant = statusVariantMap[status] || 'neutral'
  
  return (
    <Badge variant={variant}>
      {children}
    </Badge>
  )
}

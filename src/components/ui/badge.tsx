import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // CWT Studio Status badges
        new: "border-transparent bg-status-new text-white",
        queued: "border-transparent bg-status-queued text-white",
        outreach: "border-status-outreach text-status-outreach bg-transparent",
        positive: "border-transparent bg-status-positive text-white",
        neutral: "border-transparent bg-status-neutral text-white",
        negative: "border-transparent bg-status-negative text-foreground",
        unsub: "border-status-unsub text-status-unsub bg-transparent",
        bounce: "border-transparent bg-status-bounce text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

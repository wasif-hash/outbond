import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type FastSpinnerProps = {
  className?: string
  size?: "sm" | "md" | "lg"
}

const sizeMap: Record<NonNullable<FastSpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
}

export function FastSpinner({ className, size = "md" }: FastSpinnerProps) {
  return <Loader2 className={cn(sizeMap[size], "animate-spin-fast text-muted-foreground", className)} />
}

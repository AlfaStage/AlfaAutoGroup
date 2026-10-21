"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number | null
  indicatorClassName?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, indicatorClassName, ...props }, ref) => {
    const clampedValue = Math.min(100, Math.max(0, value ?? 0))

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clampedValue}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full w-full flex-1 bg-primary transition-all duration-300",
            indicatorClassName
          )}
          style={{ transform: `translateX(-${100 - clampedValue}%)` }}
        />
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }

"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal" | "both"
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, orientation = "vertical", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative",
          orientation === "vertical" && "overflow-y-auto overflow-x-hidden scrollbar-thin",
          orientation === "horizontal" && "overflow-x-auto overflow-y-hidden scrollbar-thin",
          orientation === "both" && "overflow-auto scrollbar-thin",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ScrollArea.displayName = "ScrollArea"

const ScrollBar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("hidden", className)} {...props} />
))
ScrollBar.displayName = "ScrollBar"

export { ScrollArea, ScrollBar }

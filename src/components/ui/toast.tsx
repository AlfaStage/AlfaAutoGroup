"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react"

import { cn } from "@/lib/utils"

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all animate-in fade-in-0 slide-in-from-top-2 sm:slide-in-from-bottom-2 duration-200",
  {
    variants: {
      variant: {
        default: "border-border bg-zinc-950/95 text-zinc-100 shadow-zinc-950/50",
        destructive:
          "border-red-900/60 bg-red-950/90 text-red-100 shadow-red-950/50 [&>svg]:text-red-400",
        success:
          "border-emerald-900/60 bg-emerald-950/90 text-emerald-100 shadow-emerald-950/50 [&>svg]:text-emerald-400",
        warning:
          "border-amber-900/60 bg-amber-950/90 text-amber-100 shadow-amber-950/50 [&>svg]:text-amber-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  onClose?: () => void
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant = "default", children, onClose, ...props }, ref) => {
    const Icon =
      variant === "destructive"
        ? AlertCircle
        : variant === "success"
        ? CheckCircle2
        : variant === "warning"
        ? AlertTriangle
        : Info

    return (
      <div
        ref={ref}
        className={cn(toastVariants({ variant }), className)}
        role="alert"
        {...props}
      >
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 grid gap-1">{children}</div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-foreground/50 opacity-70 transition-opacity hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }
)
Toast.displayName = "Toast"

const ToastTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("text-sm font-semibold [&+div]:text-xs leading-tight", className)}
    {...props}
  />
))
ToastTitle.displayName = "ToastTitle"

const ToastDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-xs text-muted-foreground leading-relaxed", className)}
    {...props}
  />
))
ToastDescription.displayName = "ToastDescription"

export { Toast, ToastTitle, ToastDescription, toastVariants }

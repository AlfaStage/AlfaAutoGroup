"use client"

import * as React from "react"
import { useToast } from "@/components/ui/use-toast"
import { Toast, ToastTitle, ToastDescription } from "@/components/ui/toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  if (!toasts || toasts.length === 0) return null

  return (
    <div
      aria-label="Notificações do Sistema"
      className="fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-sm sm:max-w-md flex-col-reverse gap-2 p-4 pointer-events-none"
      style={{
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      {toasts.map(({ id, title, description, variant, action }) => (
        <Toast key={id} variant={variant} onClose={() => dismiss(id)}>
          {title && <ToastTitle>{title}</ToastTitle>}
          {description && <ToastDescription>{description}</ToastDescription>}
          {action}
        </Toast>
      ))}
    </div>
  )
}

"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      className,
      checked: controlledChecked,
      defaultChecked = false,
      onCheckedChange,
      disabled,
      ...props
    },
    ref
  ) => {
    const isControlled = controlledChecked !== undefined
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked)
    const isChecked = isControlled ? controlledChecked : uncontrolledChecked

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return
      props.onClick?.(e)
      if (e.defaultPrevented) return

      const nextChecked = !isChecked
      if (!isControlled) {
        setUncontrolledChecked(nextChecked)
      }
      onCheckedChange?.(nextChecked)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      props.onKeyDown?.(e)
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        if (disabled) return
        const nextChecked = !isChecked
        if (!isControlled) {
          setUncontrolledChecked(nextChecked)
        }
        onCheckedChange?.(nextChecked)
      }
    }

    return (
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        data-state={isChecked ? "checked" : "unchecked"}
        disabled={disabled}
        ref={ref}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          isChecked ? "bg-primary" : "bg-zinc-700",
          className
        )}
        {...props}
      >
        <span
          data-state={isChecked ? "checked" : "unchecked"}
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200",
            isChecked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }

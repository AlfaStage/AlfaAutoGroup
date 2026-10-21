"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface AvatarContextType {
  imageLoaded: boolean
  setImageLoaded: (loaded: boolean) => void
  hasError: boolean
  setHasError: (err: boolean) => void
}

const AvatarContext = React.createContext<AvatarContextType>({
  imageLoaded: false,
  setImageLoaded: () => {},
  hasError: false,
  setHasError: () => {},
})

const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const [imageLoaded, setImageLoaded] = React.useState(false)
  const [hasError, setHasError] = React.useState(false)

  return (
    <AvatarContext.Provider
      value={{ imageLoaded, setImageLoaded, hasError, setHasError }}
    >
      <div
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </AvatarContext.Provider>
  )
})
Avatar.displayName = "Avatar"

export interface AvatarImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, src, alt, onLoad, onError, ...props }, ref) => {
    const { hasError, setHasError, setImageLoaded } = React.useContext(AvatarContext)

    if (hasError || !src) return null

    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        className={cn("aspect-square h-full w-full object-cover", className)}
        onLoad={(e) => {
          setImageLoaded(true)
          onLoad?.(e)
        }}
        onError={(e) => {
          setHasError(true)
          onError?.(e)
        }}
        {...props}
      />
    )
  }
)
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { imageLoaded, hasError } = React.useContext(AvatarContext)

  if (imageLoaded && !hasError) return null

  return (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted font-medium text-xs text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }

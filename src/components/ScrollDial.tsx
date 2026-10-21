"use client"

import React, { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export interface ScrollDialProps {
  max: number
  value: number
  onChange: (val: number) => void
  className?: string
}

export function ScrollDial({ max, value, onChange, className }: ScrollDialProps) {
  const [offset, setOffset] = useState(value * 40)
  const [isDragging, setIsDragging] = useState(false)
  const startY = useRef(0)
  const currentOffset = useRef(value * 40)

  useEffect(() => {
    if (!isDragging) {
      setOffset(value * 40)
      currentOffset.current = value * 40
    }
  }, [value, isDragging])

  const clamp = (val: number) => Math.max(0, Math.min(max * 40, val))

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    startY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const deltaY = startY.current - e.clientY
    startY.current = e.clientY
    currentOffset.current = clamp(currentOffset.current + deltaY)
    setOffset(currentOffset.current)

    const index = Math.round(currentOffset.current / 40)
    if (index !== value) onChange(index)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
    const index = Math.round(currentOffset.current / 40)
    const snappedOffset = index * 40
    setOffset(snappedOffset)
    currentOffset.current = snappedOffset
    if (index !== value) onChange(index)
  }

  const handleWheel = (e: React.WheelEvent) => {
    let delta = e.deltaY
    if (Math.abs(delta) > 40) {
      delta = Math.sign(delta) * 40
    }
    const newOffset = clamp(currentOffset.current + delta)
    currentOffset.current = newOffset
    setOffset(newOffset)

    const index = Math.round(newOffset / 40)
    if (index !== value) onChange(index)
  }

  return (
    <div
      className={cn(
        "h-[120px] w-16 border border-border/50 rounded-lg bg-card shadow-inner relative overflow-hidden select-none cursor-ns-resize",
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{ touchAction: "none" }}
    >
      <div
        className="absolute top-0 left-0 w-full"
        style={{
          transform: `translateY(${40 - offset}px)`,
          transition: isDragging ? "none" : "transform 0.15s ease-out",
        }}
      >
        {Array.from({ length: max + 1 }).map((_, i) => {
          const distance = Math.abs(offset - i * 40)
          const isCenter = distance < 20
          return (
            <div
              key={i}
              className={`h-[40px] flex items-center justify-center text-lg transition-all ${
                isCenter
                  ? "text-primary font-bold scale-110"
                  : "text-muted-foreground scale-90 opacity-40 hover:opacity-80 hover:scale-100"
              }`}
              onClick={() => {
                if (!isDragging) {
                  currentOffset.current = i * 40
                  setOffset(i * 40)
                  onChange(i)
                }
              }}
            >
              {i.toString().padStart(2, "0")}
            </div>
          )
        })}
      </div>
      <div className="absolute top-[40px] left-0 w-full h-[40px] border-y border-primary/20 pointer-events-none bg-primary/5" />
    </div>
  )
}

export default ScrollDial

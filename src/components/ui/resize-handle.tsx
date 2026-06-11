"use client"

import { useRef, useState } from "react"

import { cn } from "@/lib/utils"

export function ResizeHandle({
  value,
  onChange,
  min,
  max,
  side = "left",
}: {
  value: number
  onChange: (px: number) => void
  min: number
  max: number
  side?: "left" | "right"
}) {
  const [dragging, setDragging] = useState(false)
  const startX = useRef<number>(0)
  const startValue = useRef<number>(0)

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    startX.current = e.clientX
    startValue.current = value
    setDragging(true)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return
    const deltaX = e.clientX - startX.current
    // side="left": handle sits on the left edge of a right-side panel.
    // Dragging left (negative deltaX) should INCREASE the panel width.
    const next =
      side === "left"
        ? startValue.current - deltaX
        : startValue.current + deltaX
    onChange(Math.min(max, Math.max(min, next)))
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      className={cn(
        "relative w-2 shrink-0 cursor-col-resize select-none touch-none group",
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Visual line: centered 1px, transparent by default, appears on hover/drag */}
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors",
          dragging
            ? "bg-primary"
            : "bg-transparent group-hover:bg-border",
        )}
      />
    </div>
  )
}

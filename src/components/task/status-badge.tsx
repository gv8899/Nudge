"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { TASK_STATUSES, TASK_STATUS_LIST, type TaskStatus } from "@/lib/constants";

interface StatusBadgeProps {
  status: TaskStatus;
  onStatusChange?: (status: TaskStatus) => void;
}

export function StatusBadge({ status, onStatusChange }: StatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const config = TASK_STATUSES[status];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          if (onStatusChange) {
            setOpen(true);
            setFocusIndex(TASK_STATUS_LIST.indexOf(status));
          }
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusIndex((i) => (i + 1) % TASK_STATUS_LIST.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusIndex((i) => (i - 1 + TASK_STATUS_LIST.length) % TASK_STATUS_LIST.length);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusIndex >= 0 && onStatusChange) {
            onStatusChange(TASK_STATUS_LIST[focusIndex]);
            setOpen(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [open, focusIndex, status, onStatusChange]
  );

  useEffect(() => {
    if (open && menuRef.current) {
      const focused = menuRef.current.querySelector(`[data-index="${focusIndex}"]`) as HTMLElement;
      focused?.focus();
    }
  }, [open, focusIndex]);

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (onStatusChange) {
            setOpen(!open);
            if (!open) setFocusIndex(TASK_STATUS_LIST.indexOf(status));
          }
        }}
        aria-label={`狀態：${config.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="cursor-pointer p-2 rounded-md hover:bg-white/10 transition-colors"
      >
        <span
          className="block h-3 w-3 rounded-full"
          style={{ backgroundColor: config.color }}
          aria-hidden="true"
        />
      </button>

      {open && onStatusChange && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            ref={menuRef}
            role="listbox"
            aria-label="選擇狀態"
            className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg bg-card border border-border shadow-lg py-1"
          >
            {TASK_STATUS_LIST.map((s, i) => {
              const c = TASK_STATUSES[s];
              return (
                <button
                  key={s}
                  role="option"
                  aria-selected={s === status}
                  data-index={i}
                  tabIndex={focusIndex === i ? 0 : -1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(s);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-white/10 transition-colors ${
                    focusIndex === i ? "bg-white/10" : ""
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                    aria-hidden="true"
                  />
                  {c.label}
                  {s === status && (
                    <span className="ml-auto text-xs text-text-dim" aria-hidden="true">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

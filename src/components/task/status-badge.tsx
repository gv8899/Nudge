"use client";

import { useState } from "react";
import { TASK_STATUSES, TASK_STATUS_LIST, type TaskStatus } from "@/lib/constants";

interface StatusBadgeProps {
  status: TaskStatus;
  onStatusChange?: (status: TaskStatus) => void;
}

export function StatusBadge({ status, onStatusChange }: StatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const config = TASK_STATUSES[status];

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (onStatusChange) setOpen(!open);
        }}
        className="cursor-pointer p-1 rounded-md hover:bg-white/10 transition-colors"
        title={config.label}
      >
        <span
          className="block h-3 w-3 rounded-full"
          style={{ backgroundColor: config.color }}
        />
      </button>

      {open && onStatusChange && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-8 z-50 min-w-[140px] rounded-lg bg-[#2b2d30] border border-[#3a3c40] shadow-lg py-1">
            {TASK_STATUS_LIST.map((s) => {
              const c = TASK_STATUSES[s];
              return (
                <button
                  key={s}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(s);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#cdcfd2] hover:bg-white/10 transition-colors"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.label}
                  {s === status && (
                    <span className="ml-auto text-xs text-[#6b6d71]">✓</span>
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

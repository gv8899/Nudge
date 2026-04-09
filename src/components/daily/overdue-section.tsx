"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CalendarClock } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { DailyTaskAssignment } from "@/lib/types";

interface OverdueSectionProps {
  overdueTasks: DailyTaskAssignment[];
  currentDate: string;
  onToggleComplete: (assignmentId: string, taskId: string, completed: boolean) => void;
  onReschedule: (assignmentId: string, targetDate: string) => void;
}

export function OverdueSection({
  overdueTasks,
  currentDate,
  onToggleComplete,
  onReschedule,
}: OverdueSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (overdueTasks.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left py-2 px-1 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <CalendarClock className="h-4 w-4" />
        <span>過期未完成 ({overdueTasks.length})</span>
      </button>

      {isExpanded && (
        <div className="space-y-1 pl-1">
          {overdueTasks.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 py-2 px-3 rounded-lg bg-surface/50 border border-amber-500/20"
            >
              {/* 勾選完成 */}
              <button
                onClick={() => onToggleComplete(a.id, a.taskId, true)}
                className="h-5 w-5 rounded-full border-2 border-amber-500/40 hover:border-amber-400 hover:bg-amber-400/10 transition-colors flex-shrink-0"
                aria-label={`完成任務：${a.task.title}`}
              />

              {/* 任務標題 + 日期標籤 */}
              <div className="flex-1 min-w-0">
                <span className="text-sm text-text truncate block">
                  {a.task.title}
                </span>
              </div>

              <span className="text-xs text-amber-400/70 flex-shrink-0">
                {format(parseISO(a.date), "M/d")}
              </span>

              {/* 操作按鈕 */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onReschedule(a.id, currentDate)}
                  className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  排入今天
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

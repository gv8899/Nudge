"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CalendarClock, Archive } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { DailyTaskAssignment } from "@/lib/types";

interface OverdueSectionProps {
  overdueTasks: DailyTaskAssignment[];
  currentDate: string;
  onToggleComplete: (assignmentId: string, taskId: string, completed: boolean) => void;
  onReschedule: (assignmentId: string, targetDate: string) => void;
  onArchive: (assignmentId: string, taskId: string) => void;
}

export function OverdueSection({
  overdueTasks,
  currentDate,
  onToggleComplete,
  onReschedule,
  onArchive,
}: OverdueSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (overdueTasks.length === 0) return null;

  return (
    <section aria-label="過期未完成任務" className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="overdue-list"
        className="flex items-center gap-2 w-full text-left px-1 py-2 text-sm font-medium text-primary hover:bg-muted rounded-md transition-colors"
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
        <div id="overdue-list">
          {overdueTasks.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 px-1 py-2 hover:bg-muted rounded-md transition-colors group"
            >
              {/* Checkbox — 與 TaskCard 一致 */}
              <button
                role="checkbox"
                aria-checked={false}
                aria-label={`${a.task.title}：未完成`}
                onClick={() => onToggleComplete(a.id, a.taskId, true)}
                className="h-[18px] w-[18px] rounded-[4px] border-2 border-text-dim bg-transparent hover:border-muted-foreground shrink-0 cursor-pointer flex items-center justify-center transition-colors"
              />

              {/* 標題 */}
              <span className="flex-1 min-w-0 text-sm text-foreground truncate">
                {a.task.title}
              </span>

              {/* 原始日期 */}
              <span
                className="text-xs text-text-dim shrink-0 tabular-nums"
                aria-label={`原始日期：${format(parseISO(a.date), "M月d日")}`}
              >
                {format(parseISO(a.date), "M/d")}
              </span>

              {/* 排入今天 */}
              <button
                onClick={() => onReschedule(a.id, currentDate)}
                className="text-xs px-2 py-1 rounded text-primary hover:bg-muted-foreground/10 transition-colors shrink-0"
              >
                排入今天
              </button>

              {/* 封存 */}
              <button
                onClick={() => onArchive(a.id, a.taskId)}
                aria-label={`封存任務：${a.task.title}`}
                className="p-2 rounded text-text-faint hover:text-muted-foreground hover:bg-muted-foreground/10 transition-colors shrink-0"
              >
                <Archive className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

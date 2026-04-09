"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CalendarClock, Archive } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { DailyTaskAssignment } from "@/lib/types";
import { MoveTaskPopover } from "@/components/task/move-task-popover";

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
              {/* 對應 task-card 的 grip 占位（左邊對齊） */}
              <div className="h-4 w-4 shrink-0" aria-hidden="true" />

              {/* Checkbox — 與 TaskCard 一致 */}
              <button
                role="checkbox"
                aria-checked={false}
                aria-label={`${a.task.title}：未完成`}
                onClick={() => onToggleComplete(a.id, a.taskId, true)}
                className="h-[18px] w-[18px] rounded-[4px] border-2 border-text-dim bg-transparent hover:border-muted-foreground shrink-0 cursor-pointer flex items-center justify-center transition-colors"
              />

              {/* 標題 + 日期 + 排入今天 全部塞進 flex-1，讓右側 icons 對齊 task-card */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-sm text-foreground truncate">
                  {a.task.title}
                </span>
                <span
                  className="text-xs text-text-dim shrink-0 tabular-nums"
                  aria-label={`原始日期：${format(parseISO(a.date), "M月d日")}`}
                >
                  {format(parseISO(a.date), "M/d")}
                </span>
                <button
                  onClick={() => onReschedule(a.id, currentDate)}
                  className="text-xs px-2 py-1 rounded text-primary hover:bg-muted-foreground/10 transition-colors shrink-0"
                >
                  排入今天
                </button>
              </div>

              {/* 右側 icon 區 — 三個固定寬度槽位對齊 task-card 的 [file 32][calendar 32][status 28] */}

              {/* slot 1: file placeholder — w-8 = 32px = p-2 + h-4 button */}
              <div className="w-8 h-8 shrink-0" aria-hidden="true" />

              {/* slot 2: 日曆 — MoveTaskPopover 32px */}
              <MoveTaskPopover
                currentDate={a.date}
                onMove={(targetDate) => onReschedule(a.id, targetDate)}
              />

              {/* slot 3: 封存 — w-7 h-7 = 28px 對齊 task-card 的 status button (p-2 + h-3) */}
              <button
                onClick={() => onArchive(a.id, a.taskId)}
                aria-label={`封存任務：${a.task.title}`}
                className="w-7 h-7 rounded-md hover:bg-white/10 text-text-faint hover:text-muted-foreground transition-colors shrink-0 cursor-pointer flex items-center justify-center"
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

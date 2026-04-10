"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CalendarClock, Archive } from "lucide-react";
import { format, parseISO, isWeekend } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  // 六日預設收合
  const [isExpanded, setIsExpanded] = useState(() => !isWeekend(parseISO(currentDate)));
  const [archiveTarget, setArchiveTarget] = useState<{ assignmentId: string; taskId: string; title: string } | null>(null);

  if (overdueTasks.length === 0) return null;

  return (
    <section aria-label="前幾天的任務" className="mb-2">
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
        <span>前幾天的 ({overdueTasks.length})</span>
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

              {/* 標題 + 日期 */}
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
              </div>

              {/* 右側操作區：排入今天 → 日曆 → 封存 */}
              <button
                onClick={() => onReschedule(a.id, currentDate)}
                className="text-xs px-2 py-1 rounded text-primary hover:bg-muted-foreground/10 transition-colors shrink-0"
              >
                排入今天
              </button>

              <MoveTaskPopover
                currentDate={a.date}
                onMove={(targetDate) => onReschedule(a.id, targetDate)}
              />

              <button
                onClick={() => setArchiveTarget({ assignmentId: a.id, taskId: a.taskId, title: a.task.title })}
                aria-label={`封存任務：${a.task.title}`}
                className="w-7 h-7 rounded-md hover:bg-white/10 text-text-faint hover:text-muted-foreground transition-colors shrink-0 cursor-pointer flex items-center justify-center"
              >
                <Archive className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* 封存確認 */}
      <Dialog open={archiveTarget !== null} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle className="text-base font-semibold">
            封存任務
          </DialogTitle>
          <DialogDescription className="text-sm text-text-dim">
            確定要封存「{archiveTarget?.title}」嗎？封存後不會出現在任務列表。
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setArchiveTarget(null)}
              className="px-3 py-1.5 text-sm rounded-lg border border-border text-text-dim hover:text-foreground hover:bg-muted transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                if (archiveTarget) {
                  onArchive(archiveTarget.assignmentId, archiveTarget.taskId);
                  setArchiveTarget(null);
                }
              }}
              className="px-3 py-1.5 text-sm rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
            >
              封存
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

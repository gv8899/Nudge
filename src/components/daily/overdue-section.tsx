"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ChevronDown, ChevronRight, CalendarClock, Archive } from "lucide-react";
import { format, parseISO, isWeekend } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
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
  const t = useTranslations("daily");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  // 六日預設收合
  const [isExpanded, setIsExpanded] = useState(() => !isWeekend(parseISO(currentDate)));
  const [archiveTarget, setArchiveTarget] = useState<{ assignmentId: string; taskId: string; title: string } | null>(null);

  if (overdueTasks.length === 0) return null;

  return (
    <section aria-label={t("overdueSectionAria")} className="mb-2">
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
        <span>{t("overdueLabel", { count: overdueTasks.length })}</span>
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
                aria-label={t("overdueIncompleteAria", { title: a.task.title })}
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
                  aria-label={t("overdueOriginalDateAria", {
                    date: format(parseISO(a.date), "PP", { locale: dateFnsLocale }),
                  })}
                >
                  {format(parseISO(a.date), "M/d")}
                </span>
              </div>

              {/* 右側操作區 */}
              <button
                onClick={() => onReschedule(a.id, currentDate)}
                className="text-xs px-2 py-1 rounded text-primary hover:bg-muted-foreground/10 transition-colors shrink-0"
              >
                {t("overdueScheduleToday")}
              </button>

              <MoveTaskPopover
                currentDate={a.date}
                onMove={(targetDate) => onReschedule(a.id, targetDate)}
              />

              <button
                onClick={() => setArchiveTarget({ assignmentId: a.id, taskId: a.taskId, title: a.task.title })}
                aria-label={t("overdueArchiveAria", { title: a.task.title })}
                className="text-text-faint hover:text-muted-foreground transition-colors shrink-0 cursor-pointer p-2 rounded"
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
            {t("archiveTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm text-text-dim">
            {t("archiveConfirmBody", { title: archiveTarget?.title ?? "" })}
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setArchiveTarget(null)}
              className="px-3 py-1.5 text-sm rounded-lg border border-border text-text-dim hover:text-foreground hover:bg-muted transition-colors"
            >
              {tCommon("cancel")}
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
              {t("archiveButton")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

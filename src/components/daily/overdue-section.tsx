"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { SFIcon } from "@/components/ui/sf-icon";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { DailyTaskAssignment } from "@/lib/types";
import { MoveTaskPopover } from "@/components/task/move-task-popover";
import { ScheduleDialog } from "@/components/task/schedule-dialog";
import { skipOccurrence } from "@/lib/skip-task";
import { isoToday } from "@/lib/calendar-dates";

interface OverdueSectionProps {
  overdueTasks: DailyTaskAssignment[];
  currentDate: string;
  onToggleComplete: (assignmentId: string, taskId: string, completed: boolean) => void;
  onReschedule: (assignmentId: string, targetDate: string) => void;
  onArchive: (assignmentId: string, taskId: string) => void;
}

const popupClassName =
  "z-50 max-h-(--available-height) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95";

const itemClassName =
  "relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50";

export function OverdueSection({
  overdueTasks,
  currentDate,
  onToggleComplete,
  onReschedule,
  onArchive,
}: OverdueSectionProps) {
  const t = useTranslations("daily");
  // 一律預設展開 — 不論平日/週末（對齊 mac / iOS app）。
  const [isExpanded, setIsExpanded] = useState(true);
  const [scheduleTaskId, setScheduleTaskId] = useState<string | null>(null);

  if (overdueTasks.length === 0) return null;

  return (
    <section aria-label={t("overdueSectionAria")} className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="overdue-list"
        // 對齊 Mac OverdueSectionView.header：純文字 sectionHeader + textDim、
        // chevron 靠最右（展開時轉 90°）、無 icon、px-24 內縮
        className="flex items-center justify-between gap-2 w-full text-left pl-6 pr-4 min-h-11 text-section-header text-text-dim hover:bg-muted rounded-md transition-colors"
      >
        <span>{t("overdueLabel", { count: overdueTasks.length })}</span>
        <ChevronRight
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
        />
      </button>

      {isExpanded && (
        <div id="overdue-list">
          {overdueTasks.map((a) => (
            <OverdueRow
              key={a.id}
              assignment={a}
              currentDate={currentDate}
              onToggleComplete={onToggleComplete}
              onReschedule={onReschedule}
              onArchive={onArchive}
              onOpenSchedule={() => setScheduleTaskId(a.taskId)}
            />
          ))}
        </div>
      )}

      <ScheduleDialog
        taskId={scheduleTaskId}
        open={scheduleTaskId !== null}
        onOpenChange={(open) => {
          if (!open) setScheduleTaskId(null);
        }}
      />
    </section>
  );
}

interface OverdueRowProps {
  assignment: DailyTaskAssignment;
  currentDate: string;
  onToggleComplete: (assignmentId: string, taskId: string, completed: boolean) => void;
  onReschedule: (assignmentId: string, targetDate: string) => void;
  onArchive: (assignmentId: string, taskId: string) => void;
  onOpenSchedule: () => void;
}

/** Overdue row — 對齊 Mac OverdueSectionView：checkbox + title + 移到其他日期
 * icon + 完整「…」選單（移到今天/skip 或設重複/提醒/封存）+ 右鍵選單。
 */
function OverdueRow({
  assignment,
  currentDate,
  onToggleComplete,
  onReschedule,
  onArchive,
  onOpenSchedule,
}: OverdueRowProps) {
  const t = useTranslations("daily");
  const { task } = assignment;
  const isRecurring = assignment.isRecurring;
  const todayStr = isoToday();

  // Shared menu items rendered by both the … DropdownMenu and the right-click
  // ContextMenu — a plain function invoked as `{renderMenuItems()}` (not JSX
  // `<MenuItems />`) so it isn't treated as a component recreated on every
  // render.
  function renderMenuItems() {
    return (
      <>
        <DropdownMenuItem onClick={() => onReschedule(assignment.id, todayStr)}>
          <SFIcon name="calendar-badge-checkmark" className="h-[13px] w-[13px] shrink-0" />
          {t("moveToToday")}
        </DropdownMenuItem>
        {isRecurring ? (
          <DropdownMenuItem onClick={() => skipOccurrence(assignment.id, currentDate)}>
            <SFIcon name="forward" className="h-[13px] w-[13px] shrink-0" />
            {t("skipThisOccurrence")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onOpenSchedule}>
            <SFIcon name="arrow-triangle-2-circlepath" className="h-[13px] w-[13px] shrink-0" />
            {t("setRecurring")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onOpenSchedule}>
          <SFIcon name="bell" className="h-[13px] w-[13px] shrink-0" />
          {t("setReminder")}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onArchive(assignment.id, assignment.taskId)}
        >
          <SFIcon name="archivebox" className="h-[13px] w-[13px] shrink-0" />
          {t("archiveButton")}
        </DropdownMenuItem>
      </>
    );
  }

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger
        render={
          <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-md transition-colors group" />
        }
      >
        {/* 對應 task-card 的 grip 占位（左邊對齊） */}
        <div className="h-4 w-4 shrink-0" aria-hidden="true" />

        {/* Checkbox — 與 TaskCard 一致 */}
        <button
          role="checkbox"
          aria-checked={false}
          aria-label={t("overdueIncompleteAria", { title: task.title })}
          onClick={() => onToggleComplete(assignment.id, assignment.taskId, true)}
          className="h-[18px] w-[18px] rounded-[4px] border-2 border-text-dim bg-transparent hover:border-muted-foreground shrink-0 cursor-pointer flex items-center justify-center transition-colors"
        />

        <span className="flex-1 min-w-0 text-primary-row-title text-foreground truncate">
          {task.title}
        </span>

        {/* 移動日期 */}
        <MoveTaskPopover
          currentDate={assignment.date}
          onMove={(targetDate) => onReschedule(assignment.id, targetDate)}
        />

        {/* … DropdownMenu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("rowMenu")}
            className="rounded p-1 text-text-dim hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            {renderMenuItems()}
          </DropdownMenuContent>
        </DropdownMenu>
      </ContextMenuPrimitive.Trigger>

      {/* Right-click popup */}
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Positioner className="isolate z-50 outline-none">
          <ContextMenuPrimitive.Popup className={popupClassName}>
            <ContextMenuPrimitive.Item
              className={itemClassName}
              onClick={() => onReschedule(assignment.id, todayStr)}
            >
              {t("moveToToday")}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Item
              className={itemClassName}
              onClick={
                isRecurring
                  ? () => skipOccurrence(assignment.id, currentDate)
                  : onOpenSchedule
              }
            >
              {isRecurring ? t("skipThisOccurrence") : t("setRecurring")}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Item className={itemClassName} onClick={onOpenSchedule}>
              {t("setReminder")}
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Item
              className={itemClassName + " text-destructive"}
              onClick={() => onArchive(assignment.id, assignment.taskId)}
            >
              {t("archiveButton")}
            </ContextMenuPrimitive.Item>
          </ContextMenuPrimitive.Popup>
        </ContextMenuPrimitive.Positioner>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
}

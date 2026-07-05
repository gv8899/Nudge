"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { MoveTaskPopover } from "./move-task-popover";
import { TaskDetailModal } from "./task-detail-modal";
import { ScheduleDialog } from "./schedule-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { GripVertical, MoreHorizontal } from "lucide-react";
import type { DailyTaskAssignment } from "@/lib/types";
import type { TaskStatus } from "@/lib/constants";
import { isoToday } from "@/lib/calendar-dates";
import { skipOccurrence } from "@/lib/skip-task";

interface TaskCardProps {
  assignment: DailyTaskAssignment;
  currentDate: string;
  onToggleComplete: (assignmentId: string, taskId: string, completed: boolean) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onMoveToDate: (assignmentId: string, targetDate: string) => void;
  onUpdateTask: (taskId: string, updates: { title?: string; description?: string }) => void;
  onOpenDetail?: (taskId: string) => void;
  onArchive: (assignmentId: string, taskId: string) => void;
}

export function TaskCard({
  assignment,
  currentDate,
  onToggleComplete,
  onStatusChange,
  onMoveToDate,
  onUpdateTask,
  onOpenDetail,
  onArchive,
}: TaskCardProps) {
  const t = useTranslations("task");
  const tDaily = useTranslations("daily");
  const { task } = assignment;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  const isRecurring = assignment.isRecurring;
  const todayStr = isoToday();
  const isToday = currentDate === todayStr;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: assignment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDescChange = useCallback(
    (html: string) => {
      onUpdateTask(task.id, { description: html });
    },
    [task.id, onUpdateTask]
  );

  // Shared menu items rendered by both the … DropdownMenu and the right-click
  // ContextMenu — a plain function invoked as `{renderMenuItems()}` (not JSX
  // `<MenuItems />`) so it isn't treated as a component recreated on every
  // render.
  function renderMenuItems() {
    return (
      <>
        {!isToday && (
          <DropdownMenuItem onClick={() => onMoveToDate(assignment.id, todayStr)}>
            {tDaily("moveToToday")}
          </DropdownMenuItem>
        )}
        {isRecurring ? (
          <DropdownMenuItem onClick={() => skipOccurrence(assignment.id, currentDate)}>
            {tDaily("skipThisOccurrence")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
            {tDaily("setRecurring")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
          {tDaily("setReminder")}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onArchive(assignment.id, task.id)}
        >
          {tDaily("archiveButton")}
        </DropdownMenuItem>
      </>
    );
  }

  const popupClassName =
    "z-50 max-h-(--available-height) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95";

  const itemClassName =
    "relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50";

  return (
    <>
      {/* Right-click context menu wrapping the entire row */}
      <ContextMenuPrimitive.Root>
        <ContextMenuPrimitive.Trigger
          render={
            <div
              ref={setNodeRef}
              style={style}
              className="flex items-center gap-2 px-1 py-2 hover:bg-muted rounded-md transition-colors group"
            />
          }
        >
          {/* 拖曳 handle */}
          <button
            {...attributes}
            {...listeners}
            aria-label={t("dragReorder", { title: task.title })}
            className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-text-faint hover:text-muted-foreground transition-opacity shrink-0 touch-none"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Checkbox */}
          <button
            role="checkbox"
            aria-checked={assignment.isCompleted}
            aria-label={t("checkboxAria", {
              title: task.title,
              state: assignment.isCompleted ? t("stateCompleted") : t("stateIncomplete"),
            })}
            onClick={() =>
              onToggleComplete(assignment.id, task.id, !assignment.isCompleted)
            }
            className={`h-[18px] w-[18px] rounded-[4px] border-2 shrink-0 cursor-pointer flex items-center justify-center transition-colors ${
              assignment.isCompleted
                ? "bg-primary border-primary"
                : "border-text-dim bg-transparent hover:border-muted-foreground"
            }`}
          >
            {assignment.isCompleted && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          {/* 標題 */}
          <button
            onClick={() => setIsModalOpen(true)}
            className={`flex-1 min-w-0 text-primary-row-title text-left cursor-pointer bg-transparent border-none p-0 truncate ${
              assignment.isCompleted
                ? "line-through text-text-dim"
                : "text-foreground"
            }`}
          >
            {task.title}
          </button>

          {/* 移動日期 */}
          <MoveTaskPopover
            currentDate={currentDate}
            onMove={(targetDate) => onMoveToDate(assignment.id, targetDate)}
          />

          {/* … DropdownMenu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={tDaily("rowMenu")}
              className="rounded p-1 text-text-dim hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {renderMenuItems()}
            </DropdownMenuContent>
          </DropdownMenu>
        </ContextMenuPrimitive.Trigger>

        {/* Right-click popup */}
        <ContextMenuPrimitive.Portal>
          <ContextMenuPrimitive.Positioner className="isolate z-50 outline-none">
            <ContextMenuPrimitive.Popup className={popupClassName}>
              {!isToday && (
                <ContextMenuPrimitive.Item
                  className={itemClassName}
                  onClick={() => onMoveToDate(assignment.id, todayStr)}
                >
                  {tDaily("moveToToday")}
                </ContextMenuPrimitive.Item>
              )}
              <ContextMenuPrimitive.Item
                className={itemClassName}
                onClick={isRecurring ? () => skipOccurrence(assignment.id, currentDate) : () => setScheduleDialogOpen(true)}
              >
                {isRecurring ? tDaily("skipThisOccurrence") : tDaily("setRecurring")}
              </ContextMenuPrimitive.Item>
              <ContextMenuPrimitive.Item
                className={itemClassName}
                onClick={() => setScheduleDialogOpen(true)}
              >
                {tDaily("setReminder")}
              </ContextMenuPrimitive.Item>
              <ContextMenuPrimitive.Item
                className={itemClassName + " text-destructive"}
                onClick={() => onArchive(assignment.id, task.id)}
              >
                {tDaily("archiveButton")}
              </ContextMenuPrimitive.Item>
            </ContextMenuPrimitive.Popup>
          </ContextMenuPrimitive.Positioner>
        </ContextMenuPrimitive.Portal>
      </ContextMenuPrimitive.Root>

      <TaskDetailModal
        task={task}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDescChange={handleDescChange}
        onStatusChange={(s) => onStatusChange(task.id, s)}
        onTitleChange={(title) => onUpdateTask(task.id, { title })}
        onExpand={onOpenDetail ? () => { onOpenDetail(task.id); setIsModalOpen(false); } : undefined}
        wide
      />

      <ScheduleDialog
        taskId={scheduleDialogOpen ? task.id : null}
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
      />
    </>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { MoveTaskPopover } from "./move-task-popover";
import { TaskDetailModal } from "./task-detail-modal";
import { ScheduleDialog } from "./schedule-dialog";
import { SkipConfirmationDialog } from "./skip-confirmation-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { FileText, GripVertical, MoreHorizontal } from "lucide-react";
import type { DailyTaskAssignment } from "@/lib/types";
import type { TaskStatus } from "@/lib/constants";

interface TaskCardProps {
  assignment: DailyTaskAssignment;
  currentDate: string;
  onToggleComplete: (assignmentId: string, taskId: string, completed: boolean) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onMoveToDate: (assignmentId: string, targetDate: string) => void;
  onUpdateTask: (taskId: string, updates: { title?: string; description?: string }) => void;
}

export function TaskCard({
  assignment,
  currentDate,
  onToggleComplete,
  onStatusChange,
  onMoveToDate,
  onUpdateTask,
}: TaskCardProps) {
  const t = useTranslations("task");
  const tDaily = useTranslations("daily");
  const { task } = assignment;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isRecurring = assignment.isRecurring;

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

  useEffect(() => {
    setTitleValue(task.title);
  }, [task.title]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      const len = titleInputRef.current.value.length;
      titleInputRef.current.setSelectionRange(len, len);
    }
  }, [isEditingTitle]);

  const saveTitle = () => {
    const trimmed = titleValue.trim();
    if (!trimmed) {
      // 標題刪光 → 封存任務
      onStatusChange(task.id, "archived");
      return;
    }
    if (trimmed !== task.title) {
      onUpdateTask(task.id, { title: trimmed });
    }
    setIsEditingTitle(false);
  };

  const handleDescChange = useCallback(
    (html: string) => {
      onUpdateTask(task.id, { description: html });
    },
    [task.id, onUpdateTask]
  );

  const hasDescription = !!task.description?.trim();

  /** Shared menu items used by both the … DropdownMenu and the right-click ContextMenu */
  function MenuItems() {
    return (
      <>
        {isRecurring ? (
          <DropdownMenuItem onClick={() => setSkipDialogOpen(true)}>
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
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && titleValue === "") {
                  onStatusChange(task.id, "archived");
                  return;
                }
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setTitleValue(task.title);
                  setIsEditingTitle(false);
                }
              }}
              aria-label={t("editTitleAria")}
              className="flex-1 min-w-0 text-sm bg-background text-foreground rounded px-2 py-1 outline-none border border-primary"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className={`flex-1 min-w-0 text-sm text-left cursor-text bg-transparent border-none p-0 truncate ${
                assignment.isCompleted
                  ? "line-through text-text-dim"
                  : "text-foreground"
              }`}
            >
              {task.title}
            </button>
          )}

          {/* 移動日期 */}
          <MoveTaskPopover
            currentDate={currentDate}
            onMove={(targetDate) => onMoveToDate(assignment.id, targetDate)}
          />

          {/* 展開內文 */}
          <button
            onClick={() => setIsModalOpen(true)}
            aria-label={t("expandContentAria", { title: task.title })}
            className={`transition-colors cursor-pointer p-2 rounded ${
              hasDescription
                ? "text-primary hover:text-primary/80"
                : "text-text-faint hover:text-muted-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
          </button>

          {/* … DropdownMenu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={tDaily("rowMenu")}
              className="rounded p-1 text-text-dim hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <MenuItems />
            </DropdownMenuContent>
          </DropdownMenu>
        </ContextMenuPrimitive.Trigger>

        {/* Right-click popup */}
        <ContextMenuPrimitive.Portal>
          <ContextMenuPrimitive.Positioner className="isolate z-50 outline-none">
            <ContextMenuPrimitive.Popup className={popupClassName}>
              <ContextMenuPrimitive.Item
                className={itemClassName}
                onClick={isRecurring ? () => setSkipDialogOpen(true) : () => setScheduleDialogOpen(true)}
              >
                {isRecurring ? tDaily("skipThisOccurrence") : tDaily("setRecurring")}
              </ContextMenuPrimitive.Item>
              <ContextMenuPrimitive.Item
                className={itemClassName}
                onClick={() => setScheduleDialogOpen(true)}
              >
                {tDaily("setReminder")}
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
      />

      <ScheduleDialog
        taskId={scheduleDialogOpen ? task.id : null}
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
      />

      <SkipConfirmationDialog
        assignmentId={skipDialogOpen ? assignment.id : null}
        taskTitle={task.title}
        currentDate={currentDate}
        open={skipDialogOpen}
        onOpenChange={setSkipDialogOpen}
      />
    </>
  );
}

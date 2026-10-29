"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
import { SFIcon } from "@/components/ui/sf-icon";
import { GripVertical, MoreHorizontal, Plus } from "lucide-react";
import type { DailyTaskAssignment } from "@/lib/types";
import type { TaskStatus } from "@/lib/constants";
import type { ChecklistEdit } from "@/lib/checklist";
import { isoToday } from "@/lib/calendar-dates";
import { skipOccurrence } from "@/lib/skip-task";
import {
  TaskChecklistPill,
  TaskChecklistBody,
  ChecklistItemInput,
  useTaskChecklist,
  checklistCompletionFromDescChange,
} from "./task-checklist";

interface TaskCardProps {
  assignment: DailyTaskAssignment;
  currentDate: string;
  onToggleComplete: (assignmentId: string, taskId: string, completed: boolean) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onMoveToDate: (assignmentId: string, targetDate: string) => void;
  onUpdateTask: (taskId: string, updates: { title?: string; description?: string }) => void;
  onOpenDetail?: (taskId: string) => void;
  onArchive: (assignmentId: string, taskId: string) => void;
  onChecklistEdit: (assignment: DailyTaskAssignment, edit: ChecklistEdit) => void;
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
  onChecklistEdit,
}: TaskCardProps) {
  const t = useTranslations("task");
  const tDaily = useTranslations("daily");
  const { task } = assignment;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);

  const isRecurring = assignment.isRecurring;
  const todayStr = isoToday();
  const isToday = currentDate === todayStr;

  const checklist = useTaskChecklist(assignment, onChecklistEdit);

  // 詳情視窗內文改動時的「母任務完成」同步基準。非 pending 時隨 prop 更新。
  const lastDescRef = useRef(task.description);
  useEffect(() => {
    lastDescRef.current = task.description;
  }, [task.description]);

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
      const completion = checklistCompletionFromDescChange(
        lastDescRef.current,
        html,
        assignment.isRecurring,
        assignment.isCompleted
      );
      lastDescRef.current = html;
      if (completion !== null) {
        onToggleComplete(assignment.id, task.id, completion);
      }
      onUpdateTask(task.id, { description: html });
    },
    [
      task.id,
      onUpdateTask,
      onToggleComplete,
      assignment.id,
      assignment.isRecurring,
      assignment.isCompleted,
    ]
  );

  // Shared menu items rendered by both the … DropdownMenu and the right-click
  // ContextMenu — a plain function invoked as `{renderMenuItems()}` (not JSX
  // `<MenuItems />`) so it isn't treated as a component recreated on every
  // render.
  function renderMenuItems() {
    return (
      <>
        {!isRecurring && (
          <DropdownMenuItem onClick={checklist.startAdding}>
            <Plus className="h-[13px] w-[13px] shrink-0" />
            {t("checklist.add")}
          </DropdownMenuItem>
        )}
        {!isToday && (
          <DropdownMenuItem onClick={() => onMoveToDate(assignment.id, todayStr)}>
            <SFIcon name="calendar-badge-checkmark" className="h-[13px] w-[13px] shrink-0" />
            {tDaily("moveToToday")}
          </DropdownMenuItem>
        )}
        {isRecurring ? (
          <DropdownMenuItem onClick={() => skipOccurrence(assignment.id, currentDate)}>
            <SFIcon name="forward" className="h-[13px] w-[13px] shrink-0" />
            {tDaily("skipThisOccurrence")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
            <SFIcon name="arrow-triangle-2-circlepath" className="h-[13px] w-[13px] shrink-0" />
            {tDaily("setRecurring")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
          <SFIcon name="bell" className="h-[13px] w-[13px] shrink-0" />
          {tDaily("setReminder")}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onArchive(assignment.id, task.id)}
        >
          <SFIcon name="archivebox" className="h-[13px] w-[13px] shrink-0" />
          {tDaily("archiveButton")}
        </DropdownMenuItem>
      </>
    );
  }

  const popupClassName =
    "z-50 max-h-(--available-height) min-w-[200px] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95";

  const itemClassName =
    "relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none whitespace-nowrap focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50";

  return (
    <>
      {/* 外層容器：拖曳用 ref/style 掛這，讓任務列 + 子項目一起移動。
          hover 底圖掛這裡 → 有子項目時整塊（標題列＋子項目）一起變底色，
          手機沒有 hover 也是整塊為單位。 */}
      <div
        ref={setNodeRef}
        style={style}
        className="group overflow-hidden rounded-md transition-colors hover:bg-muted"
      >
      {/* Right-click context menu wrapping the entire row */}
      <ContextMenuPrimitive.Root>
        <ContextMenuPrimitive.Trigger
          render={
            <div
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer"
            />
          }
        >
          {/* 拖曳 handle */}
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label={t("dragReorder", { title: task.title })}
            className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-text-dim hover:text-primary transition-opacity shrink-0 touch-none"
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
            onClick={(e) => {
              e.stopPropagation();
              const completing = !assignment.isCompleted;
              onToggleComplete(assignment.id, task.id, completing);
              checklist.syncChildrenOnParentComplete(completing);
            }}
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

          {/* 標題 — 點文字進行內編輯；文字右側的空白區照舊冒泡到整列 → 開詳情卡片 */}
          {editingTitle ? (
            <ChecklistItemInput
              initial={task.title}
              onCommit={(v) => {
                const next = v.trim();
                if (next && next !== task.title) onUpdateTask(task.id, { title: next });
                setEditingTitle(false);
              }}
              onCancel={() => setEditingTitle(false)}
            />
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTitle(true);
                }}
                className={`min-w-0 shrink text-primary-row-title text-left cursor-text bg-transparent border-none p-0 truncate ${
                  assignment.isCompleted
                    ? "line-through text-text-dim"
                    : "text-foreground"
                }`}
              >
                {task.title}
              </button>
              {/* 標題右側填滿區：不擋冒泡 → 點這裡開詳情卡片（維持原本行為） */}
              <div className="flex-1 min-w-[3rem] self-stretch" aria-hidden="true" />
            </>
          )}

          {/* 子項目進度膠囊 — 在 ··· 左邊；自身擋冒泡 */}
          {checklist.hasChecklist && (
            <TaskChecklistPill
              done={checklist.done}
              total={checklist.total}
              collapsed={checklist.collapsed}
              onToggleCollapsed={checklist.toggleCollapsed}
            />
          )}

          {/* 新增子項目 / 移動日期 / 選單 — 擋冒泡避免點 icon 也開 modal */}
          <span onClick={(e) => e.stopPropagation()} className="contents">
          {/* ＋ 新增子項目 — 在進度膠囊與日曆之間。只有「已經有子項目」時才出現；
              第一個子項目一律從 ··· 選單新增。 */}
          {!isRecurring && checklist.hasChecklist && (
            <button
              type="button"
              onClick={checklist.startAdding}
              aria-label={t("checklist.add")}
              className="text-text-faint hover:text-primary cursor-pointer transition-colors outline-none p-2 shrink-0"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <MoveTaskPopover
            currentDate={currentDate}
            onMove={(targetDate) => onMoveToDate(assignment.id, targetDate)}
          />

          {/* … DropdownMenu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={tDaily("rowMenu")}
              className="rounded p-1 text-text-dim hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              {renderMenuItems()}
            </DropdownMenuContent>
          </DropdownMenu>
          </span>
        </ContextMenuPrimitive.Trigger>

        {/* Right-click popup */}
        <ContextMenuPrimitive.Portal>
          <ContextMenuPrimitive.Positioner className="isolate z-50 outline-none">
            <ContextMenuPrimitive.Popup className={popupClassName}>
              {!isRecurring && (
                <ContextMenuPrimitive.Item
                  className={itemClassName}
                  onClick={checklist.startAdding}
                >
                  {t("checklist.add")}
                </ContextMenuPrimitive.Item>
              )}
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

      {checklist.showBody && (
        <TaskChecklistBody
          items={checklist.items}
          adding={checklist.adding}
          onToggleItem={checklist.toggleItem}
          onAppend={checklist.append}
          onRemove={checklist.remove}
          onSetText={checklist.setItemText}
          onMove={checklist.move}
          onAddingChange={checklist.setAdding}
        />
      )}
      </div>

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

"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, GripVertical, MoreHorizontal, Plus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SFIcon } from "@/components/ui/sf-icon";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { DailyTaskAssignment } from "@/lib/types";
import type { ChecklistEdit } from "@/lib/checklist";
import { MoveTaskPopover } from "@/components/task/move-task-popover";
import { ScheduleDialog } from "@/components/task/schedule-dialog";
import { TaskDetailModal } from "@/components/task/task-detail-modal";
import {
  TaskChecklistPill,
  TaskChecklistBody,
  ChecklistItemInput,
  useTaskChecklist,
  checklistCompletionFromDescChange,
} from "@/components/task/task-checklist";
import { skipOccurrence } from "@/lib/skip-task";
import { isoToday } from "@/lib/calendar-dates";

interface OverdueSectionProps {
  overdueTasks: DailyTaskAssignment[];
  currentDate: string;
  onToggleComplete: (assignmentId: string, taskId: string, completed: boolean) => void;
  onReschedule: (assignmentId: string, targetDate: string) => void;
  onArchive: (assignmentId: string, taskId: string) => void;
  onUpdateTask: (taskId: string, updates: { title?: string; description?: string }) => void;
  onOpenDetail?: (taskId: string) => void;
  onChecklistEdit: (assignment: DailyTaskAssignment, edit: ChecklistEdit) => void;
  onReorder: (activeId: string, overId: string) => void;
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
  onUpdateTask,
  onOpenDetail,
  onChecklistEdit,
  onReorder,
}: OverdueSectionProps) {
  const t = useTranslations("daily");
  // 一律預設展開 — 不論平日/週末（對齊 mac / iOS app）。
  const [isExpanded, setIsExpanded] = useState(true);
  const [scheduleTaskId, setScheduleTaskId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={overdueTasks.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              {overdueTasks.map((a) => (
                <OverdueRow
                  key={a.id}
                  assignment={a}
                  currentDate={currentDate}
                  onToggleComplete={onToggleComplete}
                  onReschedule={onReschedule}
                  onArchive={onArchive}
                  onUpdateTask={onUpdateTask}
                  onOpenDetail={onOpenDetail}
                  onChecklistEdit={onChecklistEdit}
                  onOpenSchedule={() => setScheduleTaskId(a.taskId)}
                />
              ))}
            </SortableContext>
          </DndContext>
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
  onUpdateTask: (taskId: string, updates: { title?: string; description?: string }) => void;
  onOpenDetail?: (taskId: string) => void;
  onChecklistEdit: (assignment: DailyTaskAssignment, edit: ChecklistEdit) => void;
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
  onUpdateTask,
  onOpenDetail,
  onChecklistEdit,
  onOpenSchedule,
}: OverdueRowProps) {
  const t = useTranslations("daily");
  const tTask = useTranslations("task");
  const { task } = assignment;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const isRecurring = assignment.isRecurring;
  const todayStr = isoToday();

  const checklist = useTaskChecklist(assignment, onChecklistEdit);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: assignment.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // 詳情視窗內文改動時的母任務完成同步基準。
  const lastDescRef = useRef(task.description);
  useEffect(() => {
    lastDescRef.current = task.description;
  }, [task.description]);

  const handleDescChange = (html: string) => {
    const completion = checklistCompletionFromDescChange(
      lastDescRef.current,
      html,
      assignment.isRecurring,
      assignment.isCompleted
    );
    lastDescRef.current = html;
    if (completion !== null) {
      onToggleComplete(assignment.id, assignment.taskId, completion);
    }
    onUpdateTask(task.id, { description: html });
  };

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
            {tTask("checklist.add")}
          </DropdownMenuItem>
        )}
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
    // hover 底圖掛外層 → 有子項目時整塊一起變底色，手機也是整塊為單位。拖曳 ref/style 也掛這。
    <div
      ref={setNodeRef}
      style={style}
      className="group overflow-hidden rounded-md transition-colors hover:bg-muted"
    >
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger
        render={
          <div
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 cursor-pointer"
          />
        }
      >
        {/* 拖曳把手 — 滑到才亮，拖它排序前幾天的任務 */}
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label={tTask("dragReorder", { title: task.title })}
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-text-dim hover:text-primary transition-opacity shrink-0 touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Checkbox — 與 TaskCard 一致 */}
        <button
          role="checkbox"
          aria-checked={false}
          aria-label={t("overdueIncompleteAria", { title: task.title })}
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(assignment.id, assignment.taskId, true);
            checklist.syncChildrenOnParentComplete(true);
          }}
          className="h-[18px] w-[18px] rounded-[4px] border-2 border-text-dim bg-transparent hover:border-muted-foreground shrink-0 cursor-pointer flex items-center justify-center transition-colors"
        />

        {/* 標題 — 點文字進行內編輯；右側空白區冒泡到整列 → 開詳情卡片 */}
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
              className="min-w-0 shrink text-primary-row-title text-left cursor-text bg-transparent border-none p-0 truncate text-foreground"
            >
              {task.title}
            </button>
            <div className="flex-1 min-w-[3rem] self-stretch" aria-hidden="true" />
          </>
        )}

        {/* 子項目進度膠囊 */}
        {checklist.hasChecklist && (
          <TaskChecklistPill
            done={checklist.done}
            total={checklist.total}
            collapsed={checklist.collapsed}
            onToggleCollapsed={checklist.toggleCollapsed}
          />
        )}

        {/* 新增子項目 / 移動日期 — 擋冒泡避免點 icon 也開 modal */}
        <span onClick={(e) => e.stopPropagation()} className="contents">
        {/* ＋ 新增子項目 — 只有「已經有子項目」時才出現；第一個從 ··· 選單新增 */}
        {!isRecurring && checklist.hasChecklist && (
          <button
            type="button"
            onClick={checklist.startAdding}
            aria-label={tTask("checklist.add")}
            className="text-text-faint hover:text-primary cursor-pointer transition-colors outline-none p-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
        <MoveTaskPopover
          currentDate={assignment.date}
          onMove={(targetDate) => onReschedule(assignment.id, targetDate)}
        />

        {/* … DropdownMenu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("rowMenu")}
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
                {tTask("checklist.add")}
              </ContextMenuPrimitive.Item>
            )}
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

      <TaskDetailModal
        task={task}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDescChange={handleDescChange}
        onStatusChange={() => {}}
        onTitleChange={(title) => onUpdateTask(task.id, { title })}
        onExpand={
          onOpenDetail
            ? () => {
                onOpenDetail(task.id);
                setIsModalOpen(false);
              }
            : undefined
        }
        wide
      />
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
  );
}

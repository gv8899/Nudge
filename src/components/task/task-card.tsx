"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StatusBadge } from "./status-badge";
import { MoveTaskPopover } from "./move-task-popover";
import { TaskDetailModal } from "./task-detail-modal";
import { FileText, GripVertical } from "lucide-react";
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
  const { task } = assignment;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-2 px-1 py-2 hover:bg-muted rounded-md transition-colors group"
      >
        {/* 拖曳 handle */}
        <button
          {...attributes}
          {...listeners}
          aria-label={`拖曳排序：${task.title}`}
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-text-faint hover:text-muted-foreground transition-opacity shrink-0 touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Checkbox */}
        <button
          role="checkbox"
          aria-checked={assignment.isCompleted}
          aria-label={`${task.title}：${assignment.isCompleted ? "已完成" : "未完成"}`}
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
            aria-label="編輯任務標題"
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

        {/* 展開內文 */}
        <button
          onClick={() => setIsModalOpen(true)}
          aria-label={`展開「${task.title}」的內文`}
          className={`transition-colors cursor-pointer p-2 rounded ${
            hasDescription
              ? "text-primary hover:text-primary/80"
              : "text-text-faint hover:text-muted-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
        </button>

        {/* 移動日期 */}
        <MoveTaskPopover
          currentDate={currentDate}
          onMove={(targetDate) => onMoveToDate(assignment.id, targetDate)}
        />

        {/* 狀態 */}
        <StatusBadge
          status={task.status as TaskStatus}
          onStatusChange={(s) => onStatusChange(task.id, s)}
        />
      </div>

      <TaskDetailModal
        task={task}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDescChange={handleDescChange}
        onStatusChange={(s) => onStatusChange(task.id, s)}
      />
    </>
  );
}

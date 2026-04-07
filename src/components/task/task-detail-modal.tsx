"use client";

import { useEffect, useCallback, useRef } from "react";
import { TiptapEditor } from "./tiptap-editor";
import { StatusBadge } from "./status-badge";
import { X } from "lucide-react";
import type { Task } from "@/lib/types";
import type { TaskStatus } from "@/lib/constants";

interface TaskDetailModalProps {
  task: Task;
  open: boolean;
  onClose: () => void;
  onDescChange: (html: string) => void;
  onStatusChange: (status: TaskStatus) => void;
}

export function TaskDetailModal({
  task,
  open,
  onClose,
  onDescChange,
  onStatusChange,
}: TaskDetailModalProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // 開啟時記住先前焦點，關閉時恢復
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // 延遲一幀讓 DOM 渲染完成
      requestAnimationFrame(() => {
        dialogRef.current?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  // Escape 關閉 + 焦點陷阱
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // 鎖定背景捲動
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleDescChange = useCallback(
    (html: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const isEmpty =
          !html ||
          html === "<p></p>" ||
          html.replace(/<[^>]*>/g, "").trim() === "";
        onDescChange(isEmpty ? "" : html);
      }, 800);
    },
    [onDescChange]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
    >
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 內容 */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl bg-popover border border-border shadow-2xl outline-none"
      >
        {/* 頂部列 */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-popover border-b border-border rounded-t-xl">
          <div className="flex items-center gap-3">
            <h2 id="task-detail-title" className="text-lg font-semibold text-foreground">
              {task.title}
            </h2>
            <StatusBadge
              status={task.status as TaskStatus}
              onStatusChange={onStatusChange}
            />
          </div>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="text-text-dim hover:text-foreground transition-colors p-2 rounded-md hover:bg-border"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 編輯區 */}
        <div className="px-6 py-6 min-h-[300px]">
          <TiptapEditor
            content={task.description || ""}
            onChange={handleDescChange}
            placeholder="輸入內文..."
            editable={true}
            autoFocus={true}
          />
        </div>
      </div>
    </div>
  );
}

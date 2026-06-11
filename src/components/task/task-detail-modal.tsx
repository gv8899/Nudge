"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { TiptapEditor } from "./tiptap-editor";
import { TagPicker } from "@/components/tags/tag-picker";
import { Maximize2, X } from "lucide-react";
import type { Task } from "@/lib/types";
import type { TaskStatus } from "@/lib/constants";

interface TaskDetailModalProps {
  task: Task;
  open: boolean;
  onClose: () => void;
  onDescChange: (html: string) => void;
  onStatusChange: (status: TaskStatus) => void;
  onTagsChange?: (tagIds: string[]) => void;
  tags?: Array<{ id: string; name: string; color: string }>;
  onTitleChange?: (title: string) => void;
}

export function TaskDetailModal({
  task,
  open,
  onClose,
  onDescChange,
  onStatusChange,
  onTagsChange,
  tags = [],
  onTitleChange,
}: TaskDetailModalProps) {
  const t = useTranslations("task");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [titleDraft, setTitleDraft] = useState(task.title);

  useEffect(() => {
    setTitleDraft(task.title);
  }, [task.title]);
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
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
    >
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 內容 */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 w-[calc(100vw-2rem)] max-w-[500px] max-h-[80dvh] overflow-y-auto rounded-2xl bg-popover border border-border shadow-2xl outline-none"
      >
        {/* 頂部列 */}
        <div className="sticky top-0 z-10 px-6 py-4 bg-popover border-b border-border rounded-t-xl">
          <div className="flex items-center justify-between">
            {onTitleChange ? (
              <input
                id="task-detail-title"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  const v = titleDraft.trim();
                  if (v && v !== task.title) onTitleChange(v);
                  else setTitleDraft(task.title);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                aria-label={t("editTitleAria")}
                className="flex-1 min-w-0 text-lg font-semibold text-foreground bg-transparent border-none outline-none focus:ring-0 px-0"
              />
            ) : (
              <h2 id="task-detail-title" className="text-lg font-semibold text-foreground">
                {task.title}
              </h2>
            )}
            <div className="flex items-center gap-1">
            <a
              href={`/cards/${task.id}`}
              aria-label={t("detailExpandPage")}
              title={t("detailExpandPage")}
              className="text-text-dim hover:text-foreground transition-colors p-2 rounded-md hover:bg-border"
            >
              <Maximize2 className="h-4 w-4" />
            </a>
            <button
              onClick={onClose}
              aria-label={t("detailClose")}
              className="text-text-dim hover:text-foreground transition-colors p-2 rounded-md hover:bg-border"
            >
              <X className="h-5 w-5" />
            </button>
            </div>
          </div>
          {onTagsChange && (
            <div className="mt-2">
              <TagPicker
                taskId={task.id}
                selectedTags={tags}
                onTagsChange={onTagsChange}
              />
            </div>
          )}
        </div>

        {/* 編輯區 */}
        <div className="px-6 py-6 min-h-[300px]">
          <TiptapEditor
            key={task.id}
            content={task.description || ""}
            onChange={handleDescChange}
            placeholder={t("detailContentPlaceholder")}
            editable={true}
            autoFocus={true}
          />
        </div>
      </div>
    </div>
  );
}

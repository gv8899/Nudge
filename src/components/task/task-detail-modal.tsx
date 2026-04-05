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

  // Escape 關閉
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 內容 */}
      <div className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl bg-[#27292d] border border-[#3a3c40] shadow-2xl">
        {/* 頂部列 */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#27292d] border-b border-[#3a3c40] rounded-t-xl">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[#cdcfd2]">
              {task.title}
            </h2>
            <StatusBadge
              status={task.status as TaskStatus}
              onStatusChange={onStatusChange}
            />
          </div>
          <button
            onClick={onClose}
            className="text-[#6b6d71] hover:text-[#cdcfd2] transition-colors p-1 rounded-md hover:bg-[#3a3c40]"
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

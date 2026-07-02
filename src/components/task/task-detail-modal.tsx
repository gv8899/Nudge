"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { DebouncedSaver } from "@/lib/debounced-saver";
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
  onExpand?: () => void;
  /** 寬版（卡片快速 Modal 用）；預設窄版（任務） */
  wide?: boolean;
  /** 樂觀並行 409 衝突時 ++，強制內文編輯器重 mount 載入 server 最新內容。 */
  editorReloadToken?: number;
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
  onExpand,
  wide = false,
  editorReloadToken = 0,
}: TaskDetailModalProps) {
  const t = useTranslations("task");
  const tCommon = useTranslations("common");
  const tCardDetail = useTranslations("cardDetail");
  const [titleDraft, setTitleDraft] = useState(task.title);
  // 打字中（focused）時不要讓 task.title prop 變化蓋掉草稿 —
  // debounced 存檔後 parent 會 refetch，task.title 會變，
  // 但使用者可能還在輸入下一個字。
  const isTitleFocusedRef = useRef(false);

  useEffect(() => {
    if (isTitleFocusedRef.current) return;
    setTitleDraft(task.title);
  }, [task.title]);

  // onDescChange 用 ref 固定最新版，saver 只建一次
  const onDescChangeRef = useRef(onDescChange);
  useEffect(() => {
    onDescChangeRef.current = onDescChange;
  });
  const [descSaver] = useState(
    // eslint-disable-next-line react-hooks/refs -- ref 只在 callback 內讀取（callback 從不在 render 時執行），非 render 期讀 ref
    () =>
      new DebouncedSaver<string>((html) => {
        const isEmpty =
          !html ||
          html === "<p></p>" ||
          html.replace(/<[^>]*>/g, "").trim() === "";
        onDescChangeRef.current(isEmpty ? "" : html);
      }, 800)
  );
  // unmount 時 flush（對齊 Mac onDisappear）
  useEffect(() => () => descSaver.flush(), [descSaver]);

  // 標題打字即 debounce 存（對齊 Mac CardDetailView），blur/Enter 仍立即 flush。
  const onTitleChangeRef = useRef(onTitleChange);
  useEffect(() => {
    onTitleChangeRef.current = onTitleChange;
  });
  const [titleSaver] = useState(
    // eslint-disable-next-line react-hooks/refs -- 同上，callback 非 render 期執行
    () =>
      new DebouncedSaver<string>((v) => {
        const trimmed = v.trim();
        if (trimmed) onTitleChangeRef.current?.(trimmed);
      }, 500)
  );
  useEffect(() => () => titleSaver.flush(), [titleSaver]);

  const handleClose = useCallback(() => {
    descSaver.flush();
    titleSaver.flush();
    onClose();
  }, [descSaver, titleSaver, onClose]);

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
        handleClose();
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
  }, [open, handleClose]);

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
    (html: string) => descSaver.schedule(html),
    [descSaver]
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
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* 內容 */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative z-10 w-[calc(100vw-2rem)] ${wide ? "max-w-[920px]" : "max-w-[680px]"} max-h-[88dvh] overflow-y-auto rounded-2xl bg-popover border border-border shadow-2xl outline-none`}
      >
        {/* 頂部列 */}
        <div className="sticky top-0 z-10 px-6 py-4 bg-popover border-b border-border rounded-t-xl">
          <div className="flex items-center justify-between">
            {onTitleChange ? (
              <input
                id="task-detail-title"
                value={titleDraft}
                onChange={(e) => {
                  setTitleDraft(e.target.value);
                  titleSaver.schedule(e.target.value);
                }}
                onFocus={() => {
                  isTitleFocusedRef.current = true;
                }}
                onBlur={() => {
                  isTitleFocusedRef.current = false;
                  titleSaver.flush();
                  const v = titleDraft.trim();
                  if (!v) setTitleDraft(task.title);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    titleSaver.flush();
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
            {onExpand ? (
              <button
                type="button"
                onClick={() => {
                  descSaver.flush();
                  onExpand!();
                }}
                aria-label={t("detailExpandPage")}
                title={t("detailExpandPage")}
                className="text-text-dim hover:text-foreground transition-colors p-2 rounded-md hover:bg-border"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            ) : (
              <a
                href={`/cards/${task.id}`}
                onClick={() => descSaver.flush()}
                aria-label={t("detailExpandPage")}
                title={t("detailExpandPage")}
                className="text-text-dim hover:text-foreground transition-colors p-2 rounded-md hover:bg-border"
              >
                <Maximize2 className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={handleClose}
              aria-label={tCommon("done")}
              title={tCommon("done")}
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
        <div className="px-6 py-6 min-h-[440px]">
          <TiptapEditor
            key={`${task.id}-${editorReloadToken}`}
            content={task.description || ""}
            onChange={handleDescChange}
            placeholder={tCardDetail("editorPlaceholder")}
            editable={true}
            autoFocus={false}
          />
        </div>
      </div>
    </div>
  );
}

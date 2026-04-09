"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { type TaskStatus } from "@/lib/constants";
import { TiptapEditor } from "@/components/task/tiptap-editor";
import { StatusBadge } from "@/components/task/status-badge";

interface CardDetailProps {
  id: string;
}

interface CardData {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

// 失效 cards 列表的 SWR cache
function invalidateCardsCache() {
  globalMutate(
    (key) => typeof key === "string" && key.startsWith("/api/cards"),
    undefined,
    { revalidate: true }
  );
}

export function CardDetail({ id }: CardDetailProps) {
  const { data, error, isLoading, mutate } = useSWR<CardData>(
    `/api/tasks/${id}`,
    fetcher
  );

  // 標題編輯狀態
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoFocusedRef = useRef(false);

  useEffect(() => {
    if (data?.title !== undefined) setTitleValue(data.title);
  }, [data?.title]);

  // 首次載入時若標題為空（剛建立的新卡片），自動進入編輯模式
  useEffect(() => {
    if (!hasAutoFocusedRef.current && data && !data.title.trim()) {
      hasAutoFocusedRef.current = true;
      setIsEditingTitle(true);
    }
  }, [data]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      const len = titleInputRef.current.value.length;
      titleInputRef.current.setSelectionRange(len, len);
    }
  }, [isEditingTitle]);

  // PATCH /api/tasks/[id]
  const patchTask = useCallback(
    async (updates: { title?: string; description?: string }) => {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      mutate();
      invalidateCardsCache();
    },
    [id, mutate]
  );

  const handleDescChange = useCallback(
    (html: string) => {
      // debounce 800ms 再儲存
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const isEmpty =
          !html ||
          html === "<p></p>" ||
          html.replace(/<[^>]*>/g, "").trim() === "";
        patchTask({ description: isEmpty ? "" : html });
      }, 800);
    },
    [patchTask]
  );

  const saveTitle = () => {
    const trimmed = titleValue.trim();
    if (data && trimmed && trimmed !== data.title) {
      patchTask({ title: trimmed });
    } else if (data) {
      setTitleValue(data.title);
    }
    setIsEditingTitle(false);
  };

  const handleStatusChange = async (status: TaskStatus) => {
    // 樂觀更新
    if (data) mutate({ ...data, status }, false);
    await fetch(`/api/tasks/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    mutate();
    invalidateCardsCache();
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-8">
        <p className="text-sm text-text-dim">載入中...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-8">
        <Link
          href="/cards"
          className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> 返回卡片
        </Link>
        <p className="text-sm text-destructive">找不到這張卡片</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-8">
      <Link
        href="/cards"
        className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> 返回卡片
      </Link>

      <header className="mb-6 pb-4 border-b border-border">
        {/* 標題（可點擊編輯） */}
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") {
                setTitleValue(data.title);
                setIsEditingTitle(false);
              }
            }}
            aria-label="編輯標題"
            className="w-full text-3xl font-bold text-foreground tracking-tight bg-transparent rounded outline-none border-b-2 border-primary mb-3"
          />
        ) : (
          <button
            onClick={() => setIsEditingTitle(true)}
            className="block w-full text-left text-3xl font-bold text-foreground tracking-tight cursor-text hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors mb-3"
          >
            {data.title}
          </button>
        )}

        <div className="flex items-center gap-3 text-xs text-text-dim">
          <span>建立 {format(parseISO(data.createdAt), "yyyy/MM/dd")}</span>
          <span>·</span>
          <span>更新 {format(parseISO(data.updatedAt), "yyyy/MM/dd")}</span>
          <span>·</span>
          <StatusBadge
            status={data.status}
            onStatusChange={handleStatusChange}
          />
        </div>
      </header>

      {/* 描述（可編輯 TipTap） */}
      <div className="min-h-[300px]">
        <TiptapEditor
          content={data.description || ""}
          onChange={handleDescChange}
          placeholder="輸入內文..."
          editable={true}
        />
      </div>
    </div>
  );
}

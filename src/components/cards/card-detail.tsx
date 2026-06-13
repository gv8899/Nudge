"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import useSWR, { mutate as globalMutate } from "swr";
import { format, parseISO } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { TiptapEditor } from "@/components/task/tiptap-editor";
import { TagPicker } from "@/components/tags/tag-picker";
import { ScheduleSection } from "@/components/task/schedule-section";
import { useTags } from "@/hooks/use-tags";

interface CardDetailProps {
  id: string;
  embedded?: boolean;
  onBack?: () => void;
}

interface CardData {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ id: string; name: string; color: string }>;
}

// 失效 cards 列表的 SWR cache
function invalidateCardsCache() {
  globalMutate(
    (key) => typeof key === "string" && key.startsWith("/api/cards"),
    undefined,
    { revalidate: true }
  );
}

export function CardDetail({ id, embedded = false, onBack }: CardDetailProps) {
  const t = useTranslations("cardDetail");
  const tCommon = useTranslations("common");
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
  const [cardTags, setCardTags] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const { tags: allTags } = useTags();

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
    if (data?.tags) setCardTags(data.tags);
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

  const handleTagsChange = async (tagIds: string[]) => {
    // 樂觀更新：立即顯示 tag badge
    const newTags = tagIds
      .map((tid) => allTags.find((t) => t.id === tid))
      .filter(Boolean) as Array<{ id: string; name: string; color: string }>;
    setCardTags(newTags);

    await fetch(`/api/tasks/${id}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds }),
    });
    mutate();
    invalidateCardsCache();
  };

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

  const containerClass = embedded
    ? "px-4 md:px-6 py-6"
    : "mx-auto max-w-3xl px-4 md:px-6 py-8";

  const titleClass = embedded
    ? "min-w-0 flex-1 text-2xl font-bold text-foreground tracking-tight"
    : "min-w-0 flex-1 text-3xl font-bold text-foreground tracking-tight";

  const descMinHeight = embedded ? "min-h-[40vh]" : "min-h-[60vh]";

  if (isLoading) {
    return (
      <div className={containerClass}>
        <p className="text-sm text-text-dim">{tCommon("loading")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={containerClass}>
        {embedded ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-foreground transition-colors mb-4"
            aria-label={t("backToCards")}
            title={t("backToCards")}
          >
            <ChevronLeft className="h-5 w-5 text-primary" /> {t("backToCards")}
          </button>
        ) : (
          <Link
            href="/cards"
            className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="h-5 w-5 text-primary" /> {t("backToCards")}
          </Link>
        )}
        <p className="text-sm text-destructive">{t("notFound")}</p>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <header className="flex items-center gap-2 mb-6">
        {/* 返回按鈕：只在 embedded（右側 pane）顯示；全頁靠左側 nav 回卡片列表，不需返回鈕 */}
        {embedded && (
          <button
            type="button"
            onClick={onBack}
            title={t("backToCards")}
            aria-label={t("backToCards")}
            className="shrink-0 text-primary hover:text-primary/70 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

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
            aria-label={t("editTitleAria")}
            className={`${titleClass} bg-transparent rounded outline-none border-b-2 border-primary`}
          />
        ) : (
          <button
            onClick={() => setIsEditingTitle(true)}
            className={`${titleClass} text-left cursor-text hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors truncate`}
          >
            {data.title}
          </button>
        )}
      </header>

      {/* 描述（可編輯 TipTap） */}
      <div className={descMinHeight}>
        <TiptapEditor
          key={id}
          content={data.description || ""}
          onChange={handleDescChange}
          placeholder={t("editorPlaceholder")}
          editable={true}
        />
      </div>

      {/* 底部資訊 — embedded（右側 pane）對齊 Mac：不顯示 tags/排程/時間戳，內容為主 */}
      {!embedded && (
      <footer className="mt-8">
        <div className="border-t border-border pt-4">
          <div className="mb-3">
            <TagPicker
              taskId={id}
              selectedTags={cardTags}
              onTagsChange={handleTagsChange}
            />
          </div>
          <div className="border-t border-border pt-4 mt-4">
            <ScheduleSection taskId={id} />
          </div>
          <div className="flex items-center gap-3 text-xs text-text-dim">
            <span>{t("createdAt", { date: format(parseISO(data.createdAt), "yyyy/MM/dd") })}</span>
            <span>·</span>
            <span>{t("updatedAt", { date: format(parseISO(data.updatedAt), "yyyy/MM/dd") })}</span>
          </div>
        </div>
      </footer>
      )}
    </div>
  );
}

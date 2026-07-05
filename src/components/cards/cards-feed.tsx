"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Search, Plus, X } from "lucide-react";
import useSWR, { mutate as globalMutate } from "swr";
import { useCardsFeed } from "@/hooks/use-cards-feed";
import { useTags } from "@/hooks/use-tags";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { CardGridItem } from "./card-grid-item";
import { TaskDetailModal } from "@/components/task/task-detail-modal";
import { fetcher } from "@/lib/fetcher";
import { seedCardVersion, patchCardField } from "@/lib/card-version";
import type { Task } from "@/lib/types";
import type { TaskStatus } from "@/lib/constants";

// ── Card Modal wrapper — fetches full card and renders TaskDetailModal ─────────
interface CardModalProps {
  cardId: string;
  onClose: () => void;
  onExpand: (id: string) => void;
}

interface CardWithTags extends Task {
  tags?: Array<{ id: string; name: string; color: string }>;
}

function CardModal({ cardId, onClose, onExpand }: CardModalProps) {
  const { data, mutate } = useSWR<CardWithTags>(
    `/api/tasks/${cardId}`,
    fetcher
  );
  // 409 衝突時 ++ 強制內文編輯器重 mount 載入 server 最新內容。
  const [editorReloadToken, setEditorReloadToken] = useState(0);

  // seed 樂觀並行基準：server 回的 updatedAt = 目前畫面內容所基於的版本。
  useEffect(() => {
    if (data?.updatedAt) seedCardVersion(cardId, data.updatedAt);
  }, [cardId, data?.updatedAt]);

  const patch = useCallback(
    async (updates: Partial<{ title: string; description: string }>) => {
      const result = await patchCardField(cardId, updates);
      if (result.status === "conflict") {
        // 別台先存、這次被擋 → 採用 server 最新（方案二），丟棄本機這次編輯，
        // 重 mount 編輯器；標題由 TaskDetailModal 從 task.title 自動同步。
        await mutate(result.latest as unknown as CardWithTags, { revalidate: false });
        setEditorReloadToken((n) => n + 1);
      } else {
        // Refresh the modal data
        mutate();
      }
      // Invalidate the cards grid so the preview updates
      globalMutate(
        (key) => typeof key === "string" && key.startsWith("/api/cards"),
        undefined,
        { revalidate: true }
      );
    },
    [cardId, mutate]
  );

  if (!data) return null;

  return (
    <TaskDetailModal
      task={data}
      open={true}
      onClose={onClose}
      onTitleChange={(title) => patch({ title })}
      onDescChange={(html) => patch({ description: html })}
      onStatusChange={(_status: TaskStatus) => {
        /* status change not supported for cards in this modal */
      }}
      wide
      editorReloadToken={editorReloadToken}
      onExpand={() => onExpand(cardId)}
    />
  );
}

// ── Main feed component ────────────────────────────────────────────────────────
export function CardsFeed() {
  const t = useTranslations("cards");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const { tags: allTags } = useTags();
  const [isCreating, setIsCreating] = useState(false);
  const [modalCardId, setModalCardId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // debounce 搜尋
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { cards, isLoading, isLoadingMore, hasMore, loadMore } =
    useCardsFeed(debouncedQuery, selectedTagIds);

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // 新增空白卡片，建立後直接進入編輯頁
  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "",
          description: "<p></p>",
          status: "inbox",
        }),
      });
      if (!res.ok) throw new Error("create failed");
      const task = await res.json();
      // New card: go directly to full-page editor (better UX for an empty card)
      router.push(`/cards/${task.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  const sentinelRef = useIntersectionObserver(handleLoadMore, hasMore);

  // Filtering mode: any active query or tag selection → search results, no pagination footer
  const isFiltering = debouncedQuery.length > 0 || selectedTagIds.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6 flex flex-col min-h-0">
      {/* Search + create button row */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full pl-10 pr-8 py-2 text-field rounded-lg bg-foreground/[0.06] text-foreground placeholder:text-text-faint caret-primary focus:outline-none transition-colors"
              aria-label={t("searchAria")}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-foreground transition-colors"
                aria-label={tCommon("clear")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* 新增卡片 */}
          <button
            onClick={handleCreate}
            disabled={isCreating}
            aria-label={t("createAria")}
            title={t("createAria")}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-foreground/[0.06] text-foreground text-inline-button hover:bg-foreground/[0.10] disabled:opacity-50 transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" />
            {t("createAria")}
          </button>
        </div>

        {/* Tag filter chip cloud — AND semantics */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2.5">
            {allTags.map((tag) => {
              const active = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTagFilter(tag.id)}
                  aria-pressed={active}
                  className={
                    active
                      ? "text-field font-medium px-3 py-1.5 rounded-full bg-primary text-primary-foreground transition-colors"
                      : "text-field font-medium px-3 py-1.5 rounded-full bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.10] transition-colors"
                  }
                >
                  {tag.name}
                </button>
              );
            })}
            {selectedTagIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTagIds([])}
                className="inline-flex items-center gap-1 text-field font-medium text-primary hover:opacity-80 transition-opacity px-2.5 py-1.5"
              >
                <X className="h-3 w-3" />
                {tCommon("clear")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 卡片內容 — flex-1 so empty states can fill remaining space */}
      {isLoading && cards.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <p className="text-sm text-text-dim">{tCommon("loading")}</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 gap-2 text-center">
          {isFiltering ? (
            <>
              <Search className="h-6 w-6 text-text-dim" />
              <p className="text-empty-state text-text-dim">{t("emptyWithQuery")}</p>
            </>
          ) : (
            <>
              <p className="text-empty-state text-text-dim">{t("emptyNoCards")}</p>
              <p className="text-sm text-text-faint max-w-[280px]">{t("emptyDescription")}</p>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t("createAria")}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <div key={c.id} className="h-full">
              <CardGridItem
                card={c}
                selected={modalCardId === c.id}
                onOpenInline={(id) => setModalCardId(id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* 無限捲動觸發器 — hidden while filtering (search is page-one only) */}
      {!isFiltering && (
        <div ref={sentinelRef} className="py-4 text-center">
          {isLoadingMore && (
            <p className="text-row-body text-text-dim">{t("loadMore")}</p>
          )}
          {!hasMore && cards.length > 0 && (
            <p className="text-row-body text-text-faint">{t("noMore")}</p>
          )}
        </div>
      )}

      {/* Card quick-view modal */}
      {modalCardId && (
        <CardModal
          cardId={modalCardId}
          onClose={() => setModalCardId(null)}
          onExpand={(id) => {
            setModalCardId(null);
            router.push(`/cards/${id}`);
          }}
        />
      )}
    </div>
  );
}

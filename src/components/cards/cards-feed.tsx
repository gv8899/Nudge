"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Search, Plus } from "lucide-react";
import { useCardsFeed } from "@/hooks/use-cards-feed";
import { useTags } from "@/hooks/use-tags";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { CardListItem } from "./card-list-item";
import { CardGridItem } from "./card-grid-item";

interface CardsFeedProps {
  /** When set, card clicks call this instead of navigating. */
  onSelectCard?: (id: string) => void;
  /** Highlights the given card (list mode) / grid item. */
  selectedId?: string | null;
  /**
   * Force a specific layout. When undefined the feed renders as grid
   * (Mac parity default: no view toggle exposed to user).
   */
  layout?: "grid" | "list";
}

export function CardsFeed({ onSelectCard, selectedId, layout }: CardsFeedProps) {
  const t = useTranslations("cards");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const effectiveLayout = layout ?? "grid";

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const { tags: allTags } = useTags();
  const [isCreating, setIsCreating] = useState(false);

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
      if (onSelectCard) {
        onSelectCard(task.id);
      } else {
        router.push(`/cards/${task.id}`);
      }
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
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full pl-10 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-text-faint focus:outline-none focus:border-primary transition-colors"
              aria-label={t("searchAria")}
            />
          </div>
          {/* 新增卡片 */}
          <button
            onClick={handleCreate}
            disabled={isCreating}
            aria-label={t("createAria")}
            title={t("createAria")}
            className="flex items-center justify-center h-9 w-9 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors shrink-0"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Tag filter chip cloud — AND semantics */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
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
                      ? "text-xs px-2.5 py-1 rounded-full bg-primary text-primary-foreground border border-primary transition-colors"
                      : "text-xs px-2.5 py-1 rounded-full border border-border text-foreground hover:bg-muted transition-colors"
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
                className="text-xs text-text-dim hover:text-foreground transition-colors px-2 py-1"
              >
                {tCommon("cancel")}
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
        <div className="flex-1 flex flex-col items-center justify-center py-16 gap-2">
          {isFiltering ? (
            <>
              <Search className="h-6 w-6 text-text-dim" />
              <p className="text-empty-state text-text-dim">{t("emptyWithQuery")}</p>
            </>
          ) : (
            <p className="text-empty-state text-text-dim">{t("emptyNoCards")}</p>
          )}
        </div>
      ) : effectiveLayout === "list" ? (
        <div className="divide-y divide-border">
          {cards.map((c) => (
            <CardListItem
              key={c.id}
              card={c}
              selected={c.id === selectedId}
              onOpenInline={onSelectCard}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <div key={c.id} className="h-full">
              <CardGridItem
                card={c}
                selected={c.id === selectedId}
                onOpenInline={onSelectCard}
              />
            </div>
          ))}
        </div>
      )}

      {/* 無限捲動觸發器 — hidden while filtering (search is page-one only) */}
      {!isFiltering && (
        <div ref={sentinelRef} className="py-4 text-center">
          {isLoadingMore && (
            <p className="text-sm text-text-dim">{t("loadMore")}</p>
          )}
          {!hasMore && cards.length > 0 && (
            <p className="text-sm text-text-faint">{t("noMore")}</p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, List, LayoutGrid } from "lucide-react";
import { useCardsFeed } from "@/hooks/use-cards-feed";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { CardListItem } from "./card-list-item";
import { CardGridItem } from "./card-grid-item";

type View = "list" | "grid";
const VIEW_STORAGE_KEY = "nudge:cards-view";

export function CardsFeed() {
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // 載入 view 偏好
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as View | null;
    if (stored === "list" || stored === "grid") setView(stored);
  }, []);

  const handleViewChange = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {}
  };

  // debounce 搜尋
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { cards, isLoading, isLoadingMore, hasMore, loadMore } =
    useCardsFeed(debouncedQuery);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  const sentinelRef = useIntersectionObserver(handleLoadMore, hasMore);

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6">
      {/* 標題 + view 切換 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">卡片</h1>
        <div className="flex items-center gap-1 border border-border rounded-lg p-1">
          <button
            onClick={() => handleViewChange("list")}
            aria-label="列表檢視"
            aria-pressed={view === "list"}
            className={`p-1.5 rounded transition-colors ${
              view === "list"
                ? "bg-muted text-foreground"
                : "text-text-dim hover:text-foreground"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleViewChange("grid")}
            aria-label="網格檢視"
            aria-pressed={view === "grid"}
            className={`p-1.5 rounded transition-colors ${
              view === "grid"
                ? "bg-muted text-foreground"
                : "text-text-dim hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 搜尋框 */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋卡片..."
          className="w-full pl-10 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-text-faint focus:outline-none focus:border-primary transition-colors"
          aria-label="搜尋卡片"
        />
      </div>

      {/* 卡片內容 */}
      {isLoading && cards.length === 0 ? (
        <p className="text-sm text-text-dim text-center py-8">載入中...</p>
      ) : cards.length === 0 ? (
        <p className="text-sm text-text-dim text-center py-8">
          {debouncedQuery ? "沒有符合的卡片" : "還沒有寫過內容的任務"}
        </p>
      ) : view === "list" ? (
        <div className="divide-y divide-border">
          {cards.map((c) => (
            <CardListItem key={c.id} card={c} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <CardGridItem key={c.id} card={c} />
          ))}
        </div>
      )}

      {/* 無限捲動觸發器 */}
      <div ref={sentinelRef} className="py-4 text-center">
        {isLoadingMore && (
          <p className="text-sm text-text-dim">載入更多...</p>
        )}
        {!hasMore && cards.length > 0 && (
          <p className="text-sm text-text-faint">沒有更多卡片了</p>
        )}
      </div>
    </div>
  );
}

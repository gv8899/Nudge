"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Search, List, LayoutGrid, Plus, Eraser } from "lucide-react";
import { useCardsFeed } from "@/hooks/use-cards-feed";
import { useTags } from "@/hooks/use-tags";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { CardListItem } from "./card-list-item";
import { CardGridItem } from "./card-grid-item";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type View = "list" | "grid";
const VIEW_STORAGE_KEY = "nudge:cards-view";

export function CardsFeed() {
  const t = useTranslations("cards");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [view, setView] = useState<View>("grid");

  // localStorage 讀取偏好（client only）
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as View | null;
    if (stored === "list" || stored === "grid") setView(stored);
  }, []);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const { tags: allTags } = useTags();
  const [isCreating, setIsCreating] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [confirmCleanOpen, setConfirmCleanOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Task 3.4 — selected card tracking (sessionStorage, SSR-safe)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("cards.lastOpenedId");
  });

  const markOpened = useCallback((id: string) => {
    setSelectedCardId(id);
    try {
      sessionStorage.setItem("cards.lastOpenedId", id);
    } catch {}
  }, []);

  const handleViewChange = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {}
  };

  // debounce 搜尋
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { cards, isLoading, isLoadingMore, hasMore, loadMore, mutate } =
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
      router.push(`/cards/${task.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  // 確認後實際執行刪除
  const confirmCleanUntitled = async () => {
    if (isCleaning) return;
    setIsCleaning(true);
    try {
      const res = await fetch("/api/cards/untitled", { method: "DELETE" });
      const { deleted } = await res.json();
      if (deleted > 0) mutate();
      setConfirmCleanOpen(false);
      setToast(
        deleted > 0
          ? t("toastCleaned", { count: deleted })
          : t("toastNothingToClean")
      );
    } finally {
      setIsCleaning(false);
    }
  };

  // toast 自動消失
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  const sentinelRef = useIntersectionObserver(handleLoadMore, hasMore);

  // Filtering mode: any active query or tag selection → search results, no pagination footer
  const isFiltering = debouncedQuery.length > 0 || selectedTagIds.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6 flex flex-col min-h-0">
      {/* Row 1: 標題 + create / clean buttons */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">{tNav("cards")}</h1>
          {/* 新增卡片 — 緊鄰標題 */}
          <button
            onClick={handleCreate}
            disabled={isCreating}
            aria-label={t("createAria")}
            title={t("createAria")}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        {/* 清除空白的卡片 */}
        <button
          onClick={() => setConfirmCleanOpen(true)}
          disabled={isCleaning}
          aria-label={t("cleanUntitledAria")}
          title={t("cleanUntitledAria")}
          className="p-2 rounded-lg text-text-dim hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
        >
          <Eraser className="h-4 w-4" />
        </button>
      </div>

      {/* Row 2 (persistent search block): search input + view toggle, then tag chips */}
      <div className="mb-4">
        {/* Search input + view toggle on same row */}
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
          {/* View toggle — moved here from title row */}
          <div className="flex items-center gap-1 border border-border rounded-lg p-1 shrink-0" suppressHydrationWarning>
            <button
              suppressHydrationWarning
              onClick={() => handleViewChange("list")}
              aria-label={t("viewListAria")}
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
              suppressHydrationWarning
              onClick={() => handleViewChange("grid")}
              aria-label={t("viewGridAria")}
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
        /* Task 3.2 — empty state centered in remaining vertical space */
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
      ) : view === "list" ? (
        <div className="divide-y divide-border">
          {cards.map((c) => (
            /* Task 3.4 — capture click to track last-opened card (list view) */
            <div key={c.id} onClickCapture={() => markOpened(c.id)}>
              <CardListItem card={c} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            /* Task 3.4 — capture click to track last-opened card (grid view)。
               h-full 讓 wrapper 撐滿 grid cell，保住 CardGridItem 的等高。 */
            <div key={c.id} className="h-full" onClickCapture={() => markOpened(c.id)}>
              <CardGridItem card={c} selected={c.id === selectedCardId} />
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

      {/* 刪除確認 Dialog */}
      <Dialog open={confirmCleanOpen} onOpenChange={setConfirmCleanOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle className="text-base font-semibold">
            {t("cleanDialogTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm text-text-dim">
            {t("cleanDialogBody")}
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setConfirmCleanOpen(false)}
              disabled={isCleaning}
              className="px-3 py-1.5 text-sm rounded-lg border border-border text-text-dim hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {tCommon("cancel")}
            </button>
            <button
              onClick={confirmCleanUntitled}
              disabled={isCleaning}
              className="px-3 py-1.5 text-sm rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
            >
              {isCleaning ? t("cleanLoading") : t("cleanConfirmButton")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-popover text-popover-foreground text-sm shadow-lg ring-1 ring-foreground/10 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

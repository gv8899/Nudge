"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, List, LayoutGrid, Columns3, Plus, Eraser } from "lucide-react";
import { useCardsFeed } from "@/hooks/use-cards-feed";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { CardListItem } from "./card-list-item";
import { CardGridItem } from "./card-grid-item";
import { CardsKanban } from "./cards-kanban";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type View = "list" | "grid" | "kanban";
const VIEW_STORAGE_KEY = "nudge:cards-view";

export function CardsFeed() {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [confirmCleanOpen, setConfirmCleanOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 載入 view 偏好
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as View | null;
    if (stored === "list" || stored === "grid" || stored === "kanban") setView(stored);
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

  const { cards, isLoading, isLoadingMore, hasMore, loadMore, mutate } =
    useCardsFeed(debouncedQuery);

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
          ? `已清除 ${deleted} 張空白卡片`
          : "沒有需要清除的卡片"
      );
    } finally {
      setIsCleaning(false);
    }
  };

  // toast 自動消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  const sentinelRef = useIntersectionObserver(handleLoadMore, hasMore);

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6">
      {/* 標題 + 工具列 */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">卡片</h1>
          {/* 新增卡片 — 緊鄰標題 */}
          <button
            onClick={handleCreate}
            disabled={isCreating}
            aria-label="新增卡片"
            title="新增卡片"
            className="flex items-center justify-center h-8 w-8 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* 清除空白的卡片 */}
          <button
            onClick={() => setConfirmCleanOpen(true)}
            disabled={isCleaning}
            aria-label="清除空白的卡片"
            title="清除空白的卡片"
            className="p-2 rounded-lg text-text-dim hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <Eraser className="h-4 w-4" />
          </button>

          {/* View 切換 */}
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
            <button
              onClick={() => handleViewChange("kanban")}
              aria-label="看板檢視"
              aria-pressed={view === "kanban"}
              className={`p-1.5 rounded transition-colors ${
                view === "kanban"
                  ? "bg-muted text-foreground"
                  : "text-text-dim hover:text-foreground"
              }`}
            >
              <Columns3 className="h-4 w-4" />
            </button>
          </div>
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
      ) : cards.length === 0 && view !== "kanban" ? (
        <p className="text-sm text-text-dim text-center py-8">
          {debouncedQuery ? "沒有符合的卡片" : "還沒有寫過內容的任務"}
        </p>
      ) : view === "kanban" ? (
        <CardsKanban cards={cards} onMutate={() => mutate()} />
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

      {/* 刪除確認 Dialog */}
      <Dialog open={confirmCleanOpen} onOpenChange={setConfirmCleanOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle className="text-base font-semibold">
            清除空白的卡片
          </DialogTitle>
          <DialogDescription className="text-sm text-text-dim">
            將刪除所有沒有標題的卡片，此操作無法復原。
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setConfirmCleanOpen(false)}
              disabled={isCleaning}
              className="px-3 py-1.5 text-sm rounded-lg border border-border text-text-dim hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={confirmCleanUntitled}
              disabled={isCleaning}
              className="px-3 py-1.5 text-sm rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
            >
              {isCleaning ? "清除中..." : "確定清除"}
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

"use client";

import { useCallback } from "react";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { NoteEntry } from "./note-entry";
import { useNotesFeed } from "@/hooks/use-notes-feed";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";

export function NotesFeedPage() {
  const { notes, isLoading, isLoadingMore, hasMore, loadMore } =
    useNotesFeed();

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  const sentinelRef = useIntersectionObserver(handleLoadMore, hasMore);

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">日誌</h1>
        <Link
          href="/notes"
          aria-label="回到今天 canvas"
          title="回到今天"
          className="text-text-dim hover:text-foreground transition-colors p-2 -mr-2"
        >
          <PenLine className="h-5 w-5" />
        </Link>
      </header>

      {/* 時間軸列表 */}
      <div className="relative">
        {isLoading && notes.length === 0 && (
          <p className="text-sm text-text-dim py-8 text-center">載入中...</p>
        )}

        {!isLoading && notes.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-text-dim mb-4">
              還沒有過去的日記。現在先從今天開始寫吧。
            </p>
            <Link
              href="/notes"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <PenLine className="h-4 w-4" />
              去今天的 canvas
            </Link>
          </div>
        )}

        {notes.map((note, i) => (
          <NoteEntry
            key={note.id}
            date={note.date}
            content={note.content}
            isLast={i === notes.length - 1 && !hasMore}
          />
        ))}

        <div ref={sentinelRef} className="pl-16 md:pl-20 py-4 text-center">
          {isLoadingMore && (
            <p className="text-sm text-text-dim">載入更多...</p>
          )}
          {!hasMore && notes.length > 0 && (
            <p className="text-sm text-text-faint">沒有更多日記了</p>
          )}
        </div>
      </div>
    </div>
  );
}

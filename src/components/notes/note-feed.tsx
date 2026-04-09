"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { fetcher } from "@/lib/fetcher";
import { DailyNotes } from "@/components/daily/daily-notes";
import { NoteEntry } from "./note-entry";
import { useNotesFeed } from "@/hooks/use-notes-feed";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";

interface NoteFeedProps {
  today: string;
}

export function NoteFeed({ today }: NoteFeedProps) {
  const { data: todayNote, isLoading: todayLoading } = useSWR<{
    content: string;
  }>(`/api/daily/${today}/notes`, fetcher);

  const { notes, isLoading, isLoadingMore, hasMore, loadMore } =
    useNotesFeed(today);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  const sentinelRef = useIntersectionObserver(handleLoadMore, hasMore);

  const { dayNum, month, ariaLabel } = useMemo(() => {
    const d = parseISO(today);
    return {
      dayNum: format(d, "d"),
      month: format(d, "M 月", { locale: zhTW }),
      ariaLabel: format(d, "yyyy年M月d日的筆記", { locale: zhTW }),
    };
  }, [today]);

  return (
    <div className="mx-auto max-w-2xl px-4 md:px-6 py-6">
      <h1 className="sr-only">筆記</h1>

      {/* 時間軸容器 */}
      <div className="relative">
        {/* 今天的條目 */}
        <article
          className="relative pl-16 md:pl-20 pb-10"
          aria-label={ariaLabel}
        >
          {/* 時間軸線條 */}
          {(notes.length > 0 || isLoading) && (
            <div
              className="absolute left-[1.4rem] md:left-[1.65rem] top-5 bottom-0 w-px bg-border"
              aria-hidden="true"
            />
          )}

          {/* 時間軸圓點 — 今天特殊樣式 */}
          <div
            className="absolute left-[0.75rem] md:left-[1rem] top-1 flex items-center justify-center"
            aria-hidden="true"
          >
            <div className="h-4 w-4 rounded-full bg-primary ring-4 ring-primary/15" />
          </div>

          {/* 日期標題 */}
          <div className="flex items-center gap-2.5 mb-4">
            <span className="text-3xl font-extrabold leading-none text-foreground tabular-nums">
              {dayNum}
            </span>
            <div className="flex flex-col -space-y-0.5">
              <span className="text-xs font-medium text-text-dim leading-tight">
                {month}
              </span>
              <span className="text-xs text-primary/70 font-medium leading-tight">
                今天
              </span>
            </div>
          </div>

          {/* 可編輯的今日筆記 — 等資料載入後才渲染，避免閃爍 */}
          {todayLoading ? (
            <div className="rounded-lg border border-border-light bg-background min-h-[300px] p-4 animate-pulse" />
          ) : (
            <DailyNotes
              date={today}
              initialContent={todayNote?.content || ""}
            />
          )}
        </article>

        {/* 歷史筆記 feed */}
        {isLoading && notes.length === 0 && (
          <div className="pl-16 md:pl-20">
            <p className="text-sm text-text-dim py-8 text-center">載入中...</p>
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

        {/* 無限捲動觸發器 */}
        <div ref={sentinelRef} className="pl-16 md:pl-20 py-4 text-center">
          {isLoadingMore && (
            <p className="text-sm text-text-dim">載入更多...</p>
          )}
          {!hasMore && notes.length > 0 && (
            <p className="text-sm text-text-dim">沒有更多筆記了</p>
          )}
        </div>
      </div>
    </div>
  );
}

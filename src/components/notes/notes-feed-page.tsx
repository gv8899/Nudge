"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PenLine } from "lucide-react";
import { NoteEntry } from "./note-entry";
import { useNotesFeed } from "@/hooks/use-notes-feed";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";

export function NotesFeedPage() {
  const t = useTranslations("notes");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
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
        <h1 className="text-2xl font-bold text-foreground">{tNav("notes")}</h1>
        <Link
          href="/notes"
          aria-label={t("backToCanvasAria")}
          title={t("backToCanvasTitle")}
          className="text-text-dim hover:text-foreground transition-colors p-2 -mr-2"
        >
          <PenLine className="h-5 w-5" />
        </Link>
      </header>

      {/* 時間軸列表 */}
      <div className="relative">
        {isLoading && notes.length === 0 && (
          <p className="text-sm text-text-dim py-8 text-center">{tCommon("loading")}</p>
        )}

        {!isLoading && notes.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-text-dim mb-4">
              {t("emptyFeedPrompt")}
            </p>
            <Link
              href="/notes"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <PenLine className="h-4 w-4" />
              {t("goToCanvas")}
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
            <p className="text-sm text-text-dim">{tCommon("loading")}</p>
          )}
          {!hasMore && notes.length > 0 && (
            <p className="text-sm text-text-faint">{t("noMoreEntries")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

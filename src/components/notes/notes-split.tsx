"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { format, parseISO } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { PenLine } from "lucide-react";
import { isoToday } from "@/lib/calendar-dates";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { NoteEntry } from "./note-entry";
import { NotesCanvas } from "./notes-canvas";
import { NotesCanvasEditor } from "./notes-canvas-editor";
import { useNotesFeed } from "@/hooks/use-notes-feed";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

// ── localStorage ──────────────────────────────────────────────────────────────
const LS_DETAIL_WIDTH = "notes.web.detailWidth";
const DETAIL_MIN = 360;
const DETAIL_MAX = 900;
const DETAIL_DEFAULT = 520;

function clampDetailWidth(w: number) {
  return Math.min(DETAIL_MAX, Math.max(DETAIL_MIN, w));
}

function lsReadNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  if (v === null) return fallback;
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

// ── Desktop feed list (shared between split and feed mobile view) ─────────────
interface DesktopFeedListProps {
  selectedDate: string;
  onSelect: (date: string) => void;
  today: string;
}

function DesktopFeedList({ selectedDate, onSelect, today }: DesktopFeedListProps) {
  const t = useTranslations("notes");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { notes, isLoading, isLoadingMore, hasMore, loadMore } = useNotesFeed();

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  const sentinelRef = useIntersectionObserver(handleLoadMore, hasMore);

  const hasTodayEntry = notes.some((n) => n.date === today);

  return (
    <div className="px-4 md:px-6 py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">{tNav("notes")}</h1>
        {/* On desktop split, the canvas is always visible so no toggle needed */}
      </header>

      {/* Timeline list */}
      <div className="relative">
        {isLoading && notes.length === 0 && (
          <p className="text-sm text-text-dim py-8 text-center">{tCommon("loading")}</p>
        )}

        {/* 4.3: today placeholder row — shown when today not in feed。
            gate isLoading：初載期間 notes=[] 會誤判沒有今天、placeholder
            閃現又消失。 */}
        {!isLoading && !hasTodayEntry && (
          <TodayPlaceholderRow
            today={today}
            selected={selectedDate === today}
            onSelect={onSelect}
          />
        )}

        {notes.map((note, i) => (
          <NoteEntry
            key={note.id}
            date={note.date}
            content={note.content}
            isLast={i === notes.length - 1 && !hasMore}
            onSelect={onSelect}
            selected={note.date === selectedDate}
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

// ── 4.3: Today placeholder pseudo-row ─────────────────────────────────────────
interface TodayPlaceholderRowProps {
  today: string;
  selected: boolean;
  /** onSelect: desktop — state switch; undefined on mobile feed page */
  onSelect?: (date: string) => void;
}

function TodayPlaceholderRow({ today, selected, onSelect }: TodayPlaceholderRowProps) {
  const t = useTranslations("notes");
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const d = parseISO(today);
  const dayNum = format(d, "d");
  // en 用縮寫月名（"Apr"）對齊 Mac；同 note-entry.tsx 的處理
  const month =
    locale === "en"
      ? format(d, "MMM", { locale: dateFnsLocale })
      : t("monthLabel", { month: d.getMonth() + 1 });
  const weekday = format(d, "EEE", { locale: dateFnsLocale });

  const inner = (
    <article
      className={`relative pl-16 md:pl-20 pb-10 min-h-[88px] group${selected ? " bg-selected-fill" : ""}`}
    >
      {/* Timeline column */}
      <div
        className="absolute left-5 md:left-6 top-0 bottom-0 w-3 flex flex-col items-center pointer-events-none"
        aria-hidden="true"
      >
        <div className="h-[18px] w-px bg-border" />
        <div className="h-3 w-3 rounded-full border-2 border-primary bg-background shrink-0" />
        <div className="flex-1 w-px bg-border" />
      </div>

      {/* Hover feedback */}
      <div className="absolute left-12 md:left-14 right-0 top-0 bottom-4 rounded-lg bg-muted/0 group-hover:bg-muted/40 transition-colors pointer-events-none" />

      {/* Date header */}
      <header className="relative flex items-center gap-3 mb-5 px-4 pt-3.5">
        <span className="text-[2.25rem] font-black text-primary tabular-nums leading-none tracking-tight">
          {dayNum}
        </span>
        <div className="self-stretch w-px bg-primary/25 my-1" aria-hidden="true" />
        <div className="flex flex-col gap-1 text-[10px] font-bold tracking-[0.18em] uppercase leading-none">
          <span className="text-foreground/75">{month}</span>
          <span className="text-text-dim">{weekday}</span>
        </div>
      </header>

      {/* Placeholder text */}
      <p className="relative px-4 pb-3.5 text-row-body text-text-dim italic line-clamp-3">
        {t("todayPlaceholder")}
      </p>
    </article>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => onSelect(today)}
      >
        {inner}
      </button>
    );
  }

  // Mobile: navigate to /notes (canvas for today)
  return (
    <Link href="/notes" className="block">
      {inner}
    </Link>
  );
}

// ── Desktop detail pane ───────────────────────────────────────────────────────
interface DesktopDetailPaneProps {
  selectedDate: string;
  today: string;
}

function DesktopDetailPane({ selectedDate, today }: DesktopDetailPaneProps) {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;

  const { data, isLoading } = useSWR<{ content: string }>(
    `/api/daily/${selectedDate}/notes`,
    fetcher
  );

  const d = parseISO(selectedDate);
  const isToday = selectedDate === today;
  const dateLabel = format(d, "M/d · EEEE", { locale: dateFnsLocale });
  const fullLabel = isToday ? `${format(d, "M/d")} · ${tCommon("today")}` : dateLabel;

  return (
    <div className="px-4 md:px-6 py-6 h-full overflow-y-auto">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-foreground shrink-0">{tNav("notes")}</h1>
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-sm text-text-dim tabular-nums truncate">{fullLabel}</span>
        </div>
      </header>

      {/* Canvas editor — keyed by date so TipTap remounts on date switch */}
      {isLoading ? (
        <div className="min-h-[60vh] animate-pulse" />
      ) : (
        <NotesCanvasEditor
          key={selectedDate}
          date={selectedDate}
          initialContent={data?.content || ""}
        />
      )}
    </div>
  );
}

// ── Mobile feed list with today placeholder ───────────────────────────────────
function MobileFeedList() {
  const t = useTranslations("notes");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const today = isoToday();
  const { notes, isLoading, isLoadingMore, hasMore, loadMore } = useNotesFeed();

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  const sentinelRef = useIntersectionObserver(handleLoadMore, hasMore);
  const hasTodayEntry = notes.some((n) => n.date === today);

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

      <div className="relative">
        {isLoading && notes.length === 0 && (
          <p className="text-sm text-text-dim py-8 text-center">{tCommon("loading")}</p>
        )}

        {/* 4.3: today placeholder — mobile navigates to /notes。
            gate isLoading 同 DesktopFeedList，避免初載閃現。 */}
        {!isLoading && !hasTodayEntry && (
          <TodayPlaceholderRow today={today} selected={false} />
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

// ── Main NotesSplit component ─────────────────────────────────────────────────
export interface NotesSplitProps {
  /** Date to select/display initially; defaults to today */
  initialDate?: string;
  /** Which mobile view to render when below md breakpoint */
  mobileView: "canvas" | "feed";
}

export function NotesSplit({ initialDate, mobileView }: NotesSplitProps) {
  const today = isoToday();
  const [selectedDate, setSelectedDate] = useState<string>(initialDate ?? today);
  const [detailWidth, setDetailWidth] = useState<number>(DETAIL_DEFAULT);
  const [isMd, setIsMd] = useState<boolean>(false);

  // SSR-safe: hydrate localStorage + matchMedia in effects only
  useEffect(() => {
    setDetailWidth(clampDetailWidth(lsReadNumber(LS_DETAIL_WIDTH, DETAIL_DEFAULT)));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsMd(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMd(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleWidthChange = (px: number) => {
    const clamped = clampDetailWidth(px);
    setDetailWidth(clamped);
    localStorage.setItem(LS_DETAIL_WIDTH, String(clamped));
  };

  const handleSelect = (date: string) => {
    setSelectedDate(date);
  };

  // ── Mobile: delegate to original components (no double TipTap) ──────────
  if (!isMd) {
    if (mobileView === "feed") {
      return <MobileFeedList />;
    }
    // canvas: keep initialDate / today resolved to the right date
    const canvasDate = initialDate ?? today;
    const isToday = canvasDate === today;
    return <NotesCanvas date={canvasDate} isToday={isToday} />;
  }

  // ── Desktop split layout ─────────────────────────────────────────────────
  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* LEFT: feed column */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-[720px] mx-auto">
          <DesktopFeedList
            selectedDate={selectedDate}
            onSelect={handleSelect}
            today={today}
          />
        </div>
      </div>

      {/* RIGHT: detail pane with resize handle */}
      <div
        className="flex shrink-0 border-l border-border overflow-hidden"
        style={{ width: detailWidth }}
      >
        <ResizeHandle
          value={detailWidth}
          onChange={handleWidthChange}
          min={DETAIL_MIN}
          max={DETAIL_MAX}
          side="left"
        />
        <div className="flex-1 overflow-y-auto">
          <DesktopDetailPane selectedDate={selectedDate} today={today} />
        </div>
      </div>
    </div>
  );
}

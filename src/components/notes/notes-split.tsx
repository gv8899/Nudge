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
        <h1 className="text-column-title text-foreground">{tNav("notes")}</h1>
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

        {notes.map((note) => (
          <NoteEntry
            key={note.id}
            date={note.date}
            content={note.content}
            onSelect={onSelect}
            selected={note.date === selectedDate}
          />
        ))}

        <div ref={sentinelRef} className="py-4 text-center">
          {isLoadingMore && (
            <p className="text-sm text-text-dim">{tCommon("loading")}</p>
          )}
          {!hasMore && notes.length > 0 && (
            <p className="text-row-body text-text-faint">{t("noMoreEntries")}</p>
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

  // 同 NoteEntry 的 pillar anatomy — placeholder 預覽維持 italic dim
  // （A34：對齊 Mac todayPlaceholderRow；A35：真實內容才用 foreground）。
  const inner = (
    <article
      className={`flex items-start gap-3 px-4 py-3.5 min-h-[88px] rounded-lg transition-colors duration-300${
        selected ? " bg-selected-fill" : " hover:bg-surface-hover"
      }`}
    >
      <div className="w-14 shrink-0 flex flex-col items-center">
        <span className="text-feed-day-number text-foreground tabular-nums">
          {dayNum}
        </span>
        <span className="text-weekday-label text-text-dim">{month}</span>
      </div>

      <p className="flex-1 min-w-0 text-row-body text-text-dim italic line-clamp-3">
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
      {/* A38：「日誌」標題只在 feed pane（DesktopFeedList）保留一份，
          detail pane header 只留日期，避免雙標題。 */}
      <header className="flex items-center justify-between gap-4 mb-8">
        <span className="text-column-title text-text-dim tabular-nums truncate">{fullLabel}</span>
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
        <h1 className="text-column-title text-foreground">{tNav("notes")}</h1>
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

        {notes.map((note) => (
          <NoteEntry key={note.id} date={note.date} content={note.content} />
        ))}

        <div ref={sentinelRef} className="py-4 text-center">
          {isLoadingMore && (
            <p className="text-sm text-text-dim">{tCommon("loading")}</p>
          )}
          {!hasMore && notes.length > 0 && (
            <p className="text-row-body text-text-faint">{t("noMoreEntries")}</p>
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
    // md+ 扣掉頂部 toolbar 帶 48px，否則整頁會多出一截捲動
    <div className="flex h-[100dvh] md:h-[calc(100dvh-48px)] overflow-hidden">
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
        className="flex shrink-0 overflow-hidden"
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

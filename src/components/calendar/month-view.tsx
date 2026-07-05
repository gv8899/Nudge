"use client";

import { format, parseISO } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { monthGrid, addMonths, isoToday } from "@/lib/calendar-dates";
import type { CalendarEvent } from "@/lib/google-calendar/types";
import { EventPopover } from "./event-popover";

interface Props {
  date: string;
  onSelectDate: (d: string) => void;
  onOpenDay: (d: string) => void;
  eventsByDate: Map<string, CalendarEvent[]>;
  isLoading: boolean;
}

/** Weekday header labels for Mon–Sun (0=Mon … 6=Sun) */
function buildWeekdayLabels(locale: string): string[] {
  // Construct labels using a known Monday (2024-01-01 was a Monday)
  const dateFnsLocale =
    locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const isCompact = locale === "zh-TW" || locale === "zh" || locale === "ja";
  const fmtStr = isCompact ? "EEEEE" : "EEE";
  const labels: string[] = [];
  // 2024-01-01 is a Monday
  for (let i = 0; i < 7; i++) {
    const d = new Date(2024, 0, 1 + i); // Mon → Sun
    labels.push(format(d, fmtStr, { locale: dateFnsLocale }));
  }
  return labels;
}

function formatMonthTitle(isoDate: string, locale: string): string {
  const dateFnsLocale =
    locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const d = parseISO(isoDate);
  if (locale === "zh-TW" || locale === "zh") {
    return format(d, "yyyy 年 M 月", { locale: dateFnsLocale });
  }
  if (locale === "ja") {
    return format(d, "yyyy年M月", { locale: dateFnsLocale });
  }
  return format(d, "MMMM yyyy", { locale: dateFnsLocale });
}

function isoMonth(isoDate: string): string {
  return isoDate.slice(0, 7); // "YYYY-MM"
}

export function CalendarMonthView({
  date,
  onSelectDate,
  onOpenDay,
  eventsByDate,
  isLoading,
}: Props) {
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const today = isoToday();
  const anchorMonth = isoMonth(date);
  const grid = monthGrid(date); // string[][]  6 rows × 7 cols
  const weekdayLabels = buildWeekdayLabels(locale);
  const now = new Date();

  // Collect all events in grid for loading check
  const allGridDates = grid.flat();
  const allGridEvents = allGridDates.flatMap((d) => eventsByDate.get(d) ?? []);
  const showSpinner = isLoading && allGridEvents.length === 0;

  return (
    <div className="flex flex-col px-4 md:px-8 pt-4 pb-8 gap-0">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => onSelectDate(addMonths(date, -1))}
          aria-label={t("prevMonthAria")}
          className="flex items-center justify-center w-9 h-9 rounded-full text-text-dim hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex flex-1 items-center justify-center gap-3">
          <span className="text-column-title text-foreground">
            {formatMonthTitle(date, locale)}
          </span>
          <button
            type="button"
            onClick={() => onSelectDate(isoToday())}
            className="text-row-meta text-foreground hover:bg-surface-hover px-3 py-1 rounded-full transition-colors"
          >
            {tCommon("today")}
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSelectDate(addMonths(date, 1))}
          aria-label={t("nextMonthAria")}
          className="flex items-center justify-center w-9 h-9 rounded-full text-text-dim hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Weekday header row ──────────────────────────────── */}
      <div className="grid grid-cols-7 mb-1">
        {weekdayLabels.map((label, i) => (
          <div
            key={i}
            className="text-weekday-label text-text-dim text-center py-1"
          >
            {label}
          </div>
        ))}
      </div>

      {/* ── Loading spinner ─────────────────────────────────── */}
      {showSpinner && (
        <div
          role="status"
          aria-busy="true"
          aria-label={t("panelLoading")}
          className="flex justify-center items-center py-16"
        >
          <div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground/40 animate-spin" />
          <span className="sr-only">{t("panelLoading")}</span>
        </div>
      )}

      {/* ── Grid ────────────────────────────────────────────── */}
      {!showSpinner && (
        <div
          role="grid"
          className="grid grid-cols-7 grid-rows-6 h-[calc(100dvh-180px)] md:h-[calc(100dvh-176px)] min-h-[480px]"
        >
          {grid.flat().map((iso) => {
            const isPadDay = isoMonth(iso) !== anchorMonth;
            const isToday = iso === today;
            const isSelected = iso === date;
            const rawEvents = eventsByDate.get(iso) ?? [];

            // Sort: allDay first, then by start
            const events = [...rawEvents].sort((a, b) => {
              if (a.allDay && !b.allDay) return -1;
              if (!a.allDay && b.allDay) return 1;
              return new Date(a.start).getTime() - new Date(b.start).getTime();
            });

            const totalEvents = events.length;
            // Bars we'll render: up to 3
            const bars = events.slice(0, 3);
            const overflowAll = totalEvents > 3 ? totalEvents - 3 : 0;
            // sm: show 1 bar; overflow for sm = total - 1
            const overflowSm = totalEvents > 1 ? totalEvents - 1 : 0;

            const dayNum = parseInt(iso.slice(8), 10);

            const handleCellClick = () => {
              if (iso === date) {
                onOpenDay(iso);
              } else {
                onSelectDate(iso);
              }
            };

            return (
              <div
                key={iso}
                role="gridcell"
                aria-selected={isSelected}
                aria-label={iso}
                onClick={handleCellClick}
                className={`flex flex-col items-stretch gap-y-0.5 px-[3px] pt-1 pb-1 overflow-hidden border-t border-border/40 cursor-pointer transition-colors ${
                  isSelected ? "bg-selected-fill" : "hover:bg-surface-hover"
                }`}
              >
                {/* Day number */}
                <div className="flex justify-center mb-0.5 shrink-0">
                  <span
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-weekday-label select-none ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : isSelected && !isToday
                          ? "ring-2 ring-foreground text-foreground"
                          : isPadDay
                            ? "text-text-dim"
                            : "text-foreground"
                    }`}
                  >
                    {dayNum}
                  </span>
                </div>

                {/* Event bars */}
                {bars.map((e, idx) => {
                  const isPast = !e.allDay && new Date(e.end) < now;
                  const barBase =
                    "w-full shrink-0 text-left rounded px-1 py-0.5 truncate text-chip-label leading-4";
                  const barColor = isPast
                    ? "bg-primary/30 text-text-dim"
                    : "bg-primary text-primary-foreground";

                  return (
                    <EventPopover key={`${e.calendarId}-${e.id}`} event={e}>
                      <button
                        type="button"
                        onClick={(ev) => ev.stopPropagation()}
                        className={`${barBase} ${barColor} ${
                          idx > 0 ? "max-sm:hidden" : ""
                        }`}
                        title={e.title}
                      >
                        {e.title}
                      </button>
                    </EventPopover>
                  );
                })}

                {/* Overflow: sm (shows when bar 2+ are hidden) */}
                {overflowSm > 0 && (
                  <span className="shrink-0 text-chip-label text-text-dim px-1 sm:hidden">
                    +{overflowSm}
                  </span>
                )}

                {/* Overflow: md+ (only when > 3 events) */}
                {overflowAll > 0 && (
                  <span className="shrink-0 text-chip-label text-text-dim px-1 max-sm:hidden">
                    +{overflowAll}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

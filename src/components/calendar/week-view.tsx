"use client";

import { format } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { weekRange, addDays, isoToday } from "@/lib/calendar-dates";
import type { CalendarEvent } from "@/lib/google-calendar/types";
import { EventPopover } from "./event-popover";

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface Props {
  date: string;
  onDateChange: (d: string) => void;
  eventsByDate: Map<string, CalendarEvent[]>;
  isLoading: boolean;
}

export function CalendarWeekView({ date, onDateChange, eventsByDate, isLoading }: Props) {
  const t = useTranslations("calendar");
  const tDaily = useTranslations("daily");
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;

  const { start, end } = weekRange(date);

  // Build array of 7 YYYY-MM-DD strings: Mon..Sun
  const days: string[] = [];
  let cur = start;
  for (let i = 0; i < 7; i++) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  // Range label "M/d – M/d"
  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  const rangeLabel = `${startDate.getMonth() + 1}/${startDate.getDate()} – ${endDate.getMonth() + 1}/${endDate.getDate()}`;

  // Collect all events for this week to detect whole-week empty
  const allWeekEvents = days.flatMap((d) => eventsByDate.get(d) ?? []);
  const isWeekEmpty = !isLoading && allWeekEvents.length === 0;

  // For past-event dimming — computed once per render
  const now = new Date();

  return (
    <div className="pt-4 pb-8 space-y-5">
      {/* Header row */}
      <div className="flex items-center gap-2">
        {/* Prev week */}
        <button
          type="button"
          onClick={() => onDateChange(addDays(date, -7))}
          aria-label={tDaily("prevWeekAria")}
          className="flex items-center justify-center w-9 h-9 rounded-full text-text-dim hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Center: range label + 本週 button */}
        <div className="flex flex-1 items-center justify-center gap-3">
          <span className="text-column-title text-foreground tabular-nums">
            {rangeLabel}
          </span>
          <button
            type="button"
            onClick={() => onDateChange(isoToday())}
            className="text-row-meta text-foreground hover:bg-surface-hover px-3 py-1 rounded-full transition-colors"
          >
            {t("thisWeek")}
          </button>
        </div>

        {/* Next week */}
        <button
          type="button"
          onClick={() => onDateChange(addDays(date, 7))}
          aria-label={tDaily("nextWeekAria")}
          className="flex items-center justify-center w-9 h-9 rounded-full text-text-dim hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Loading spinner (only when loading with no data at all) */}
      {isLoading && allWeekEvents.length === 0 && (
        <div
          role="status"
          aria-busy="true"
          aria-label={t("panelLoading")}
          className="flex justify-center py-16"
        >
          <div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground/40 animate-spin" />
          <span className="sr-only">{t("panelLoading")}</span>
        </div>
      )}

      {/* Whole-week empty state */}
      {isWeekEmpty && (
        <div className="py-16 text-center text-empty-state text-text-dim">
          {t("weekEmpty")}
        </div>
      )}

      {/* 7 day blocks */}
      {!isWeekEmpty && !isLoading && (
        <div className="space-y-6">
          {days.map((dayStr) => {
            const dayDate = new Date(dayStr + "T00:00:00");
            const dayLabel = format(dayDate, "EEEE M/d", { locale: dateFnsLocale });
            const rawEvents = eventsByDate.get(dayStr) ?? [];

            // Sort: allDay first, then by start time
            const events = [...rawEvents].sort((a, b) => {
              if (a.allDay && !b.allDay) return -1;
              if (!a.allDay && b.allDay) return 1;
              return new Date(a.start).getTime() - new Date(b.start).getTime();
            });

            const hasEvents = events.length > 0;

            return (
              <section key={dayStr} aria-label={dayLabel}>
                {/* Day label */}
                <div
                  className={`text-row-title-em mb-2 ${
                    hasEvents ? "text-foreground" : "text-text-dim"
                  }`}
                >
                  {dayLabel}
                </div>

                {/* Event rows (only if day has events) */}
                {hasEvents && (
                  <div className="space-y-1.5">
                    {events.map((e) => {
                      const isPast = !e.allDay && new Date(e.end) < now;
                      const rowBg = isPast
                        ? "bg-foreground/[0.02]"
                        : "bg-foreground/[0.04]";
                      const textColor = isPast ? "text-text-dim" : "text-foreground";

                      return (
                        <EventPopover key={`${e.calendarId}-${e.id}`} event={e}>
                          <button
                            type="button"
                            className={`flex w-full items-baseline gap-3 rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-foreground/[0.07] ${rowBg}`}
                          >
                            {/* Time column */}
                            <span
                              className={`w-14 shrink-0 text-row-title-em tabular-nums ${textColor}`}
                            >
                              {e.allDay ? t("eventAllDay") : formatHHMM(e.start)}
                            </span>

                            {/* Title */}
                            <span
                              className={`text-row-title truncate ${textColor}`}
                              title={e.title}
                            >
                              {e.title}
                            </span>
                          </button>
                        </EventPopover>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

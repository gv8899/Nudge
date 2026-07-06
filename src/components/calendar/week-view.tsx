"use client";

import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { weekRange, addDays, isoToday } from "@/lib/calendar-dates";
import { layoutDayEvents, type EventInterval } from "@/lib/calendar-layout";
import type { CalendarEvent } from "@/lib/google-calendar/types";
import { EventPopover } from "./event-popover";

const HOUR_H = 48; // px per hour — 與 mac CalendarWeekGridView.hourHeight 對齊

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 當日 00:00 起算分鐘數（local time，與 formatHHMM 同一時區語意） */
function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** 事件在該日欄的分鐘區間 — 跨午夜夾到 24:00 */
function dayInterval(e: CalendarEvent, dayStr: string): EventInterval {
  const startMin = minutesOfDay(e.start);
  const endsSameDay = format(new Date(e.end), "yyyy-MM-dd") === dayStr;
  const endMin = endsSameDay ? minutesOfDay(e.end) : 24 * 60;
  return { startMin, endMin: Math.max(endMin, startMin) };
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
  const today = isoToday();

  const days: string[] = [];
  let cur = start;
  for (let i = 0; i < 7; i++) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  const rangeLabel = `${startDate.getMonth() + 1}/${startDate.getDate()} – ${endDate.getMonth() + 1}/${endDate.getDate()}`;

  const allWeekEvents = days.flatMap((d) => eventsByDate.get(d) ?? []);
  const now = new Date();

  // 捲動定位：「當週最早的非全天事件」那個小時（如最早 9:30 → 定位
  // 9:00）；整週沒事件 → 09:00。每次切週、資料到位後都重新定位（用
  // weekStart 當 key）。往上多留 12px，時間刻度 label 才不會被上緣
  // （整日列）切掉一半。與 mac 一致。
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledWeekRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading || scrolledWeekRef.current === start) return;
    const el = scrollRef.current;
    if (!el) return;
    const mins = allWeekEvents
      .filter((e) => !e.allDay)
      .map((e) => minutesOfDay(e.start));
    const hour = mins.length
      ? Math.min(Math.max(Math.floor(Math.min(...mins) / 60), 0), 23)
      : 9;
    // 頂端落在「前一小時的線之後」(+14px 跳過該線與 label)：前一小時
    // 的格線藏在視窗外，只露出該格空白當呼吸空間 — 頂端不會在 header
    // 底線下多出一條線。
    el.scrollTop = Math.max((hour - 1) * HOUR_H + 14, 0);
    scrolledWeekRef.current = start;
  });

  return (
    <div className="pt-4 pb-8 space-y-5">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onDateChange(addDays(date, -7))}
          aria-label={tDaily("prevWeekAria")}
          className="flex items-center justify-center w-9 h-9 rounded-full text-text-dim hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-3">
          <span className="text-column-title text-foreground tabular-nums">{rangeLabel}</span>
          <button
            type="button"
            onClick={() => onDateChange(isoToday())}
            className="text-row-meta text-foreground hover:bg-surface-hover px-3 py-1 rounded-full transition-colors"
          >
            {t("thisWeek")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => onDateChange(addDays(date, 7))}
          aria-label={tDaily("nextWeekAria")}
          className="flex items-center justify-center w-9 h-9 rounded-full text-text-dim hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Loading spinner（首次載入且完全沒資料時）；空週照樣顯示網格 */}
      {isLoading && allWeekEvents.length === 0 ? (
        <div
          role="status"
          aria-busy="true"
          aria-label={t("panelLoading")}
          className="flex justify-center py-16"
        >
          <div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground/40 animate-spin" />
          <span className="sr-only">{t("panelLoading")}</span>
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              {/* 日 header 列 */}
              <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border">
                <div />
                {days.map((dayStr) => {
                  const dayDate = new Date(dayStr + "T00:00:00");
                  const isToday = dayStr === today;
                  return (
                    <div
                      key={dayStr}
                      className="border-l border-border py-2.5 text-center"
                    >
                      <div
                        className={`mb-1 text-[11px] tracking-wide ${
                          isToday ? "text-primary font-semibold" : "text-text-dim"
                        }`}
                      >
                        {format(dayDate, "EEE", { locale: dateFnsLocale })}
                      </div>
                      <span
                        className={`inline-block h-[30px] w-[30px] rounded-full text-[17px] font-semibold leading-[30px] tabular-nums ${
                          isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                        }`}
                      >
                        {dayDate.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 全天事件列 — 只在本週有全天事件時出現，平常不佔空帶 */}
              {allWeekEvents.some((e) => e.allDay) && (
                <div className="grid min-h-[30px] grid-cols-[56px_repeat(7,1fr)] border-b border-border">
                  <div className="pr-2 pt-2 text-right text-[10px] text-text-faint">
                    {t("eventAllDay")}
                  </div>
                  {days.map((dayStr) => {
                    const allDayEvents = (eventsByDate.get(dayStr) ?? []).filter((e) => e.allDay);
                    return (
                      <div key={dayStr} className="flex flex-col gap-[3px] border-l border-border p-[3px]">
                        {allDayEvents.map((e) => (
                          <EventPopover key={`${e.calendarId}-${e.id}`} event={e}>
                            <button
                              type="button"
                              title={e.title}
                              className="truncate rounded-md bg-primary px-2 py-[3px] text-left text-[11.5px] font-medium text-primary-foreground hover:bg-primary/90"
                            >
                              {e.title}
                            </button>
                          </EventPopover>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 時間網格（垂直捲動） */}
              <div ref={scrollRef} className="h-[calc(100dvh-240px)] min-h-[320px] overflow-y-auto">
                <div
                  className="relative grid grid-cols-[56px_repeat(7,1fr)]"
                  style={{ height: 24 * HOUR_H }}
                >
                  {/* 時間軸欄 */}
                  <div className="relative">
                    {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
                      <div
                        key={h}
                        className="absolute right-2 -translate-y-1/2 bg-background px-0.5 text-[10.5px] text-text-faint tabular-nums"
                        style={{ top: h * HOUR_H }}
                      >
                        {`${String(h).padStart(2, "0")}:00`}
                      </div>
                    ))}
                  </div>

                  {/* 7 日欄 */}
                  {days.map((dayStr) => {
                    const timed = (eventsByDate.get(dayStr) ?? []).filter((e) => !e.allDay);
                    const intervals = timed.map((e) => dayInterval(e, dayStr));
                    const placements = layoutDayEvents(intervals);
                    return (
                      <div key={dayStr} className="relative border-l border-border">
                        {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
                          <div
                            key={h}
                            className="pointer-events-none absolute inset-x-0 border-t border-border opacity-55"
                            style={{ top: h * HOUR_H }}
                          />
                        ))}
                        {timed.map((e, idx) => {
                          const { startMin, endMin } = intervals[idx];
                          const { column, columnCount } = placements[idx];
                          const durMin = endMin - startMin;
                          const isShort = durMin <= 30;
                          const isPast = new Date(e.end) < now;
                          const widthPct = 100 / columnCount;
                          return (
                            <EventPopover key={`${e.calendarId}-${e.id}`} event={e}>
                              <button
                                type="button"
                                title={`${e.title}\n${formatHHMM(e.start)} – ${formatHHMM(e.end)}`}
                                className={`absolute overflow-hidden rounded-[7px] px-1.5 py-[3px] text-left transition-colors ${
                                  isPast
                                    ? "bg-[color-mix(in_srgb,var(--foreground)_7%,var(--background))] hover:bg-[color-mix(in_srgb,var(--foreground)_12%,var(--background))]"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                                }`}
                                style={{
                                  top: (startMin / 60) * HOUR_H + 1,
                                  height: Math.max((durMin / 60) * HOUR_H - 3, 14),
                                  left: `calc(${column * widthPct}% + 2px)`,
                                  width: `calc(${widthPct}% - ${columnCount > 1 ? 4 : 6}px)`,
                                  zIndex: 10 + column,
                                }}
                              >
                                <div
                                  className={`text-xs leading-tight ${
                                    isPast
                                      ? "font-medium text-text-dim"
                                      : "font-semibold text-primary-foreground"
                                  } ${isShort ? "line-clamp-1 text-[11.5px]" : "line-clamp-2"}`}
                                >
                                  {e.title}
                                </div>
                                {!isShort && (
                                  <div
                                    className={`truncate text-[10.5px] tabular-nums ${
                                      isPast ? "text-text-dim" : "text-primary-foreground/80"
                                    }`}
                                  >
                                    {formatHHMM(e.start)} – {formatHHMM(e.end)}
                                  </div>
                                )}
                              </button>
                            </EventPopover>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

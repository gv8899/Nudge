"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useSidebarCollapsed } from "@/components/sidebar/sidebar-layout";
import { isoToday, weekRange, monthGrid } from "@/lib/calendar-dates";
import { useCalendarRange } from "@/hooks/use-calendar-range";
import { CalendarDayView } from "./day-view";
import { CalendarWeekView } from "./week-view";
import { CalendarMonthView } from "./month-view";
import { CalendarEmptyState } from "./calendar-empty-state";

type Mode = "day" | "week" | "month";
const MODE_KEY = "calendar.web.mode";
const MODES: Mode[] = ["day", "week", "month"];
/** ?date= 來自 URL（可被手改），格式不對就退回今天，避免 NaN 日期打 API。 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function CalendarHost({
  initialMode,
  initialDate,
}: {
  initialMode?: string;
  initialDate?: string;
}) {
  const t = useTranslations("calendar");
  const sidebarCollapsed = useSidebarCollapsed();
  const router = useRouter();
  const pathname = usePathname();

  const [mode, setMode] = useState<Mode>(() =>
    MODES.includes(initialMode as Mode) ? (initialMode as Mode) : "week"
  );
  const [date, setDate] = useState<string>(() =>
    initialDate && DATE_RE.test(initialDate) ? initialDate : isoToday()
  );

  // 首次掛載：URL 沒帶 mode 時，採用 localStorage 記住的偏好
  useEffect(() => {
    if (!MODES.includes(initialMode as Mode)) {
      try {
        const saved = localStorage.getItem(MODE_KEY) as Mode | null;
        if (saved && MODES.includes(saved)) setMode(saved);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL 同步（可書籤）；replace 不疊 history
  useEffect(() => {
    router.replace(`${pathname}?mode=${mode}&date=${date}`, { scroll: false });
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {}
  }, [mode, date, pathname, router]);

  // range：day 抓整週（週 strip 圓點用）、week 抓週、month 抓 6 週網格界
  const range =
    mode === "month"
      ? (() => {
          const grid = monthGrid(date);
          return { start: grid[0][0], end: grid[5][6] };
        })()
      : weekRange(date);
  const { data, eventsByDate, error, isLoading, refresh } = useCalendarRange(
    range.start,
    range.end
  );

  const openDay = useCallback((d: string) => {
    setDate(d);
    setMode("day");
  }, []);

  // API 失敗時顯示錯誤態（含重試），不要讓它看起來像「沒有行程」的假空態。
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <CalendarEmptyState variant="error" onRetry={refresh} />
      </div>
    );
  }

  if (data && !data.connected) {
    const variant = data.reason === "reauth_required" ? "reauth" : "not_connected";
    return (
      <div className="min-h-screen bg-background md:ml-0">
        <CalendarEmptyState variant={variant} />
      </div>
    );
  }

  const segmented = (
    <div
      className="inline-flex items-center gap-0.5 p-1 rounded-full bg-muted"
      role="tablist"
    >
      {MODES.map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => setMode(m)}
          className={`px-4 h-7 rounded-full text-inline-button transition-colors ${
            mode === m
              ? "bg-background text-foreground shadow-sm"
              : "text-text-dim hover:text-foreground"
          }`}
        >
          {t(
            m === "day" ? "modeDay" : m === "week" ? "modeWeek" : "modeMonth"
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-8">
      {/* 日|週|月 segmented — 對齊 Mac calendarToolbar：md+ 放頂部 toolbar
          帶左段（跟 sidebar 收合聯動滑動），手機留在內容頂。 */}
      <div
        className="hidden md:flex items-center fixed top-[14px] h-9 z-40 transition-[left] duration-300 ease-out"
        style={{ left: sidebarCollapsed ? 66 : 200 }}
      >
        {segmented}
      </div>
      <div className="flex justify-center pt-4 md:hidden">{segmented}</div>

      {mode === "day" && (
        <div className="mx-auto max-w-[720px] px-4 md:px-6">
          <CalendarDayView
            date={date}
            onDateChange={setDate}
            eventsByDate={eventsByDate}
            isLoading={isLoading}
          />
        </div>
      )}
      {mode === "week" && (
        <div className="mx-auto max-w-[1200px] px-4 md:px-6">
          <CalendarWeekView
            date={date}
            onDateChange={setDate}
            eventsByDate={eventsByDate}
            isLoading={isLoading}
          />
        </div>
      )}
      {mode === "month" && (
        <CalendarMonthView
          date={date}
          onSelectDate={setDate}
          onOpenDay={openDay}
          eventsByDate={eventsByDate}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

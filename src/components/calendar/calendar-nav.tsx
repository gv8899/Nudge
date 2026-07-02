"use client";

import {
  format,
  addDays,
  subDays,
  startOfWeek,
  isSameDay,
} from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function toWeekStart(date: string) {
  return startOfWeek(new Date(date + "T00:00:00"), { weekStartsOn: 1 });
}

interface CalendarNavProps {
  date: string;
  onDateChange: (date: string) => void;
  /** 圓點日期 override（YYYY-MM-DD）。提供時不打 /api/daily/week，
   *  由呼叫端決定資料源（Calendar 頁 = events；Daily 頁不傳 = 任務）。 */
  dotDates?: string[];
}

export function CalendarNav({ date, onDateChange, dotDates }: CalendarNavProps) {
  const t = useTranslations("daily");
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const dateObj = new Date(date + "T00:00:00");

  const weekStart = toWeekStart(date);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: weekData } = useSWR<{ datesWithTasks: string[] }>(
    dotDates
      ? null
      : `/api/daily/week?start=${weekStartStr}&end=${weekEndStr}`,
    fetcher,
    { keepPreviousData: true }
  );
  const dotSet = new Set(dotDates ?? weekData?.datesWithTasks ?? []);

  const goTo = (d: Date) => {
    onDateChange(format(d, "yyyy-MM-dd"));
  };

  return (
    <nav aria-label={t("calendarNavAria")} className="px-1 md:px-2 py-2">
      <div className="flex items-stretch justify-between gap-0.5 md:gap-1">
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, dateObj);
          const dayStr = format(day, "yyyy-MM-dd");
          const hasDot = dotSet.has(dayStr);
          return (
            <button
              key={dayStr}
              onClick={() => goTo(day)}
              aria-label={format(day, "PPPP", { locale: dateFnsLocale })}
              aria-current={isSelected ? "date" : undefined}
              className="flex-1 flex flex-col items-center gap-1 py-1 transition-colors"
            >
              <span className="text-xs font-medium text-text-dim">
                {format(day, "EEE", { locale: dateFnsLocale }).replace(/^週/, "")}
              </span>
              <span
                className={`flex items-center justify-center h-9 w-9 rounded-full text-lg tabular-nums transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-foreground font-medium"
                }`}
              >
                {format(day, "d")}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  hasDot && !isSelected ? "bg-primary" : "bg-transparent"
                }`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function WeekNavControls({ date, onDateChange }: CalendarNavProps) {
  const tCommon = useTranslations("common");
  const t = useTranslations("daily");
  const weekStart = toWeekStart(date);
  const go = (d: Date) => onDateChange(format(d, "yyyy-MM-dd"));
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => go(subDays(weekStart, 7))}
        aria-label={t("prevWeekAria")}
        className="flex items-center justify-center h-9 w-9 rounded-full text-text-dim hover:text-foreground hover:bg-surface-hover transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => go(new Date())}
        className="flex items-center justify-center h-9 px-4 rounded-full text-sm text-foreground hover:bg-surface-hover transition-colors whitespace-nowrap"
      >
        {tCommon("today")}
      </button>
      <button
        onClick={() => go(addDays(weekStart, 7))}
        aria-label={t("nextWeekAria")}
        className="flex items-center justify-center h-9 w-9 rounded-full text-text-dim hover:text-foreground hover:bg-surface-hover transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

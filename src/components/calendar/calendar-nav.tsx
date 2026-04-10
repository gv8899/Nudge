"use client";

import {
  format,
  addDays,
  subDays,
  startOfWeek,
  isSameDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface CalendarNavProps {
  date: string;
  onDateChange: (date: string) => void;
}

export function CalendarNav({ date, onDateChange }: CalendarNavProps) {
  const dateObj = new Date(date + "T00:00:00");

  const weekStart = startOfWeek(dateObj, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: weekData } = useSWR<{ datesWithTasks: string[] }>(
    `/api/daily/week?start=${weekStartStr}&end=${weekEndStr}`,
    fetcher,
    { keepPreviousData: true }
  );
  const datesWithTasks = new Set(weekData?.datesWithTasks || []);

  const goTo = (d: Date) => {
    onDateChange(format(d, "yyyy-MM-dd"));
  };

  const goToPrevWeek = () => goTo(subDays(weekStart, 7));
  const goToNextWeek = () => goTo(addDays(weekStart, 7));
  const goToToday = () => goTo(new Date());

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <nav aria-label="週曆導航" className="bg-card rounded-xl px-2 md:px-3 py-2 flex items-center justify-center gap-0.5 md:gap-1">
      <button
        onClick={goToPrevWeek}
        aria-label="上一週"
        className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-white/10 transition-colors shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-0 md:gap-0.5 flex-1 md:flex-initial">
        {weekDays.map((day, i) => {
          const isSelected = isSameDay(day, dateObj);
          const dayStr = format(day, "yyyy-MM-dd");
          const hasTasks = datesWithTasks.has(dayStr);

          return (
            <button
              key={dayStr}
              onClick={() => goTo(day)}
              aria-label={format(day, "M月d日 EEEE")}
              aria-current={isSelected ? "date" : undefined}
              className={`
                relative flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1.5
                flex-1 md:flex-initial md:w-16 py-1.5 md:py-1.5 rounded-full text-sm transition-all
                ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                }
              `}
            >
              {hasTasks && !isSelected && (
                <span className="h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-primary order-first md:order-none" aria-hidden="true" />
              )}
              <span className={`hidden md:inline ${isSelected ? "" : "text-muted-foreground"}`}>
                {dayNames[i]}
              </span>
              <span className={`text-xs md:text-sm ${isSelected ? "font-semibold" : "text-foreground font-medium"}`}>
                {format(day, "d")}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={goToNextWeek}
        aria-label="下一週"
        className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-white/10 transition-colors shrink-0"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div className="w-px h-5 bg-border mx-0.5 md:mx-1 shrink-0" aria-hidden="true" />
      <button
        onClick={goToToday}
        className="text-xs md:text-sm text-foreground px-1.5 md:px-2.5 py-1.5 rounded-full hover:bg-white/10 hover:text-foreground transition-colors shrink-0 whitespace-nowrap"
      >
        Today
      </button>
    </nav>
  );
}

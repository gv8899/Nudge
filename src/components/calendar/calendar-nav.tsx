"use client";

import {
  format,
  addDays,
  subDays,
  startOfWeek,
  isToday,
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
    <div className="bg-[#2b2d30] rounded-xl px-3 py-2 inline-flex items-center gap-1">
      <button
        onClick={goToPrevWeek}
        className="text-[#9b9da0] hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-0.5">
        {weekDays.map((day, i) => {
          const isSelected = isSameDay(day, dateObj);
          const dayStr = format(day, "yyyy-MM-dd");
          const hasTasks = datesWithTasks.has(dayStr);

          return (
            <button
              key={dayStr}
              onClick={() => goTo(day)}
              className={`
                relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all
                ${
                  isSelected
                    ? "bg-[#5cb3e8] text-white font-medium"
                    : "text-[#9b9da0] hover:text-white hover:bg-white/10"
                }
              `}
            >
              {hasTasks && !isSelected && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#5cb3e8]" />
              )}
              <span className={isSelected ? "" : "text-[#9b9da0]"}>
                {dayNames[i]}
              </span>
              <span className={isSelected ? "font-semibold" : "text-[#cdcfd2] font-medium"}>
                {format(day, "d")}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={goToNextWeek}
        className="text-[#9b9da0] hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div className="w-px h-5 bg-[#4a4c50] mx-1" />
      <button
        onClick={goToToday}
        className="text-sm text-[#cdcfd2] px-2.5 py-1.5 rounded-full hover:bg-white/10 hover:text-white transition-colors"
      >
        Today
      </button>
    </div>
  );
}

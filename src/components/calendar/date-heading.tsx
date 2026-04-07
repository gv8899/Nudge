"use client";

import { format, isToday, isWeekend } from "date-fns";
import { enUS } from "date-fns/locale";

interface DateHeadingProps {
  date: string;
}

export function DateHeading({ date }: DateHeadingProps) {
  const dateObj = new Date(date + "T00:00:00");
  const dayOfWeek = format(dateObj, "EEEE", { locale: enUS });
  const dateFormatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}, ${dateObj.getFullYear()}`;
  const isWeekendDay = isWeekend(dateObj);

  return (
    <div className="space-y-1 pt-2">
      <p
        className={`text-sm font-medium ${
          isWeekendDay ? "text-weekend" : "text-primary"
        }`}
      >
        {dayOfWeek}
      </p>
      <h1 className="text-3xl font-bold text-foreground tracking-tight">
        {dateFormatted}
      </h1>
    </div>
  );
}

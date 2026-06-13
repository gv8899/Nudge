"use client";

import { format } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { useLocale } from "next-intl";

interface DateHeadingProps {
  date: string;
}

// 用最長可能的日期字串作為「ghost」撐開最大寬度，避免日期長短切換時版面跳動。
// en 最寬格式：Sep 30, 2026（三字母月 + 兩位數日 + 4 位數年）。
const GHOST_DATE = "Sep 30, 2026";

export function DateHeading({ date }: DateHeadingProps) {
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const dateObj = new Date(date + "T00:00:00");
  const valid = !Number.isNaN(dateObj.getTime());
  const dayOfWeek = valid ? format(dateObj, "EEEE", { locale: dateFnsLocale }) : "—";
  const dateFormat = locale === "en" ? "MMM d, yyyy" : "M月d日";
  const dateFormatted = valid ? format(dateObj, dateFormat, { locale: dateFnsLocale }) : date;

  return (
    <div className="space-y-1 pt-2">
      <p className="text-date-eyebrow text-text-dim">{dayOfWeek}</p>
      <h1 className="text-date-title text-foreground">
        <span className="inline-grid">
          <span
            className="col-start-1 row-start-1 invisible pointer-events-none"
            aria-hidden="true"
          >
            {GHOST_DATE}
          </span>
          <span className="col-start-1 row-start-1">{dateFormatted}</span>
        </span>
      </h1>
    </div>
  );
}

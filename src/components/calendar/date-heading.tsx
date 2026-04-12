"use client";

import { format } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { useLocale } from "next-intl";

interface DateHeadingProps {
  date: string;
}

// 用最長可能的日期字串作為「ghost」撐開最大寬度，避免日期長短切換時版面跳動。
// 12/30, 2026 是視覺上最寬的格式（兩位數月 + 兩位數日 + 4 位數年）。
const GHOST_DATE = "12/30, 2026";

export function DateHeading({ date }: DateHeadingProps) {
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const dateObj = new Date(date + "T00:00:00");
  const dayOfWeek = format(dateObj, "EEEE", { locale: dateFnsLocale });
  const dateFormatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}, ${dateObj.getFullYear()}`;

  return (
    <div className="space-y-1 pt-2">
      <p className="text-sm font-medium text-primary">{dayOfWeek}</p>
      <h1 className="text-3xl font-bold text-foreground tracking-tight tabular-nums">
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

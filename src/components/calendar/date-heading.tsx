"use client";

import { format } from "date-fns";
import { enUS } from "date-fns/locale";

interface DateHeadingProps {
  date: string;
}

// 用最長可能的日期字串作為「ghost」撐開最大寬度，避免日期長短切換時版面跳動。
// September 是最長月份名，加兩位數日 + 4 位數年。
const GHOST_DATE = "September 30, 2026";

export function DateHeading({ date }: DateHeadingProps) {
  const dateObj = new Date(date + "T00:00:00");
  const valid = !Number.isNaN(dateObj.getTime());
  const dayOfWeek = valid ? format(dateObj, "EEEE", { locale: enUS }) : "—";
  const dateFormatted = valid ? format(dateObj, "MMMM d, yyyy", { locale: enUS }) : date;

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

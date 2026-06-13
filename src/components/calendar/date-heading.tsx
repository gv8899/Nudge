"use client";

import { format } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { useLocale } from "next-intl";

interface DateHeadingProps {
  date: string;
}

export function DateHeading({ date }: DateHeadingProps) {
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const dateObj = new Date(date + "T00:00:00");
  const valid = !Number.isNaN(dateObj.getTime());

  const dayOfWeek = valid ? format(dateObj, "EEEE", { locale: dateFnsLocale }) : "—";
  // 對齊 Mac：zh-TW「2026 年 6 月 11 日」、ja「2026年6月11日」、en「June 11, 2026」
  const dateFmt =
    locale === "en" ? "MMMM d, yyyy" : locale === "ja" ? "yyyy年M月d日" : "yyyy 年 M 月 d 日";
  // ghost 撐開最大寬度，避免日期長短切換時版面跳動
  const ghost =
    locale === "en"
      ? "September 30, 2026"
      : locale === "ja"
        ? "2026年12月30日"
        : "2026 年 12 月 30 日";
  const dateFormatted = valid ? format(dateObj, dateFmt, { locale: dateFnsLocale }) : date;

  return (
    <div className="space-y-1 pt-2">
      <p className="text-date-eyebrow text-text-dim">{dayOfWeek}</p>
      <h1 className="text-date-title text-foreground">
        <span className="inline-grid">
          <span
            className="col-start-1 row-start-1 invisible pointer-events-none"
            aria-hidden="true"
          >
            {ghost}
          </span>
          <span className="col-start-1 row-start-1">{dateFormatted}</span>
        </span>
      </h1>
    </div>
  );
}

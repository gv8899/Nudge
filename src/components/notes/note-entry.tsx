"use client";

import { Link } from "@/i18n/routing";
import { format, parseISO } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { useTranslations, useLocale } from "next-intl";
import { stripHtml } from "@/lib/strip-html";

interface NoteEntryProps {
  date: string;
  content: string;
  onSelect?: (date: string) => void;
  selected?: boolean;
}

export function NoteEntry({
  date,
  content,
  onSelect,
  selected = false,
}: NoteEntryProps) {
  const t = useTranslations("notes");
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const d = parseISO(date);
  const dayNum = format(d, "d");
  // en 用縮寫月名（"Apr"）對齊 Mac；ICU 模板無法簡潔把數字轉月名，故 en 走 date-fns、zh/ja 走既有 i18n 模板
  const month =
    locale === "en"
      ? format(d, "MMM", { locale: dateFnsLocale })
      : t("monthLabel", { month: d.getMonth() + 1 });
  const ariaLabel = t("entryAria", {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  });

  const preview = stripHtml(content, 220);

  // Mac pillar anatomy (NotesFeedRow)：左 56px 日期柱（日號上／縮寫月
  // dim 下）+ 右預覽，無 timeline spine。A36：transition-colors 近似
  // Mac 的 selection spring fade。
  const inner = (
    <article
      className={`flex items-start gap-3 px-4 py-3.5 min-h-[88px] rounded-lg transition-colors duration-300${
        selected ? " bg-selected-fill" : " hover:bg-surface-hover"
      }`}
    >
      <div className="w-14 shrink-0 flex flex-col items-center">
        <span className="text-feed-day-number text-foreground tabular-nums">
          {dayNum}
        </span>
        <span className="text-weekday-label text-text-dim">{month}</span>
      </div>

      {/* A35：真實 entry 預覽用 text-foreground（跟 placeholder 的 dim 區隔）*/}
      <p className="flex-1 min-w-0 text-row-body text-foreground line-clamp-3">
        {preview}
      </p>
    </article>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        aria-pressed={selected}
        className="block w-full text-left"
        onClick={() => onSelect(date)}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link href={`/notes/${date}`} aria-label={ariaLabel} className="block">
      {inner}
    </Link>
  );
}

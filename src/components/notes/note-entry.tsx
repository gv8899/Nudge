"use client";

import { Link } from "@/i18n/routing";
import { format, parseISO } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { useTranslations, useLocale } from "next-intl";
import { stripHtml } from "@/lib/strip-html";

interface NoteEntryProps {
  date: string;
  content: string;
  isLast?: boolean;
  onSelect?: (date: string) => void;
  selected?: boolean;
}

export function NoteEntry({
  date,
  content,
  isLast = false,
  onSelect,
  selected = false,
}: NoteEntryProps) {
  const t = useTranslations("notes");
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const d = parseISO(date);
  const dayNum = format(d, "d");
  const month = t("monthLabel", { month: d.getMonth() + 1 });
  const weekday = format(d, "EEE", { locale: dateFnsLocale });
  const ariaLabel = t("entryAria", {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  });

  const preview = stripHtml(content, 220);

  const inner = (
    <article
      className={`relative pl-16 md:pl-20 pb-10 min-h-[88px] group${selected ? " bg-selected-fill" : ""}`}
    >
      {/* 時間軸 column */}
      <div
        className="absolute left-5 md:left-6 top-0 bottom-0 w-3 flex flex-col items-center pointer-events-none"
        aria-hidden="true"
      >
        <div className="h-[18px] w-px bg-border" />
        <div className="h-3 w-3 rounded-full bg-primary shrink-0" />
        {!isLast && <div className="flex-1 w-px bg-border" />}
      </div>

      {/* Hover 反饋 */}
      <div className="absolute left-12 md:left-14 right-0 top-0 bottom-4 rounded-lg bg-muted/0 group-hover:bg-muted/40 transition-colors pointer-events-none" />

      {/* 日期標題 */}
      <header className="relative flex items-center gap-3 mb-5 px-4 pt-3.5">
        <span className="text-[2.25rem] font-black text-primary tabular-nums leading-none tracking-tight">
          {dayNum}
        </span>
        <div
          className="self-stretch w-px bg-primary/25 my-1"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1 text-[10px] font-bold tracking-[0.18em] uppercase leading-none">
          <span className="text-foreground/75">{month}</span>
          <span className="text-text-dim">{weekday}</span>
        </div>
      </header>

      {/* 筆記純文字預覽 */}
      <p className="relative px-4 pb-3.5 text-row-body text-text-dim line-clamp-3">
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

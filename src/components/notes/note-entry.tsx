"use client";

import Link from "next/link";
import DOMPurify from "dompurify";
import { format, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";

interface NoteEntryProps {
  date: string;
  content: string;
  isLast?: boolean;
}

export function NoteEntry({ date, content, isLast = false }: NoteEntryProps) {
  const d = parseISO(date);
  const dayNum = format(d, "d");
  const month = format(d, "M 月", { locale: zhTW });
  const weekday = format(d, "EEE", { locale: zhTW });
  const ariaLabel = format(d, "yyyy年M月d日的日記", { locale: zhTW });

  const cleanHTML = DOMPurify.sanitize(content);

  return (
    <Link
      href={`/notes/${date}`}
      aria-label={ariaLabel}
      className="block"
    >
      <article className="relative pl-16 md:pl-20 pb-10 group">
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
        <header className="relative flex items-center gap-3 mb-5">
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

        {/* 筆記內容 */}
        <div
          className="relative tiptap-container"
          dangerouslySetInnerHTML={{ __html: cleanHTML }}
        />
      </article>
    </Link>
  );
}

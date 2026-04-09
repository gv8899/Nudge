"use client";

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
  const ariaLabel = format(d, "yyyy年M月d日的筆記", { locale: zhTW });

  const cleanHTML = DOMPurify.sanitize(content);

  return (
    <article className="relative pl-16 md:pl-20 pb-10" aria-label={ariaLabel}>
      {/* 時間軸 column — dot + line 一體化 */}
      <div
        className="absolute left-5 md:left-6 top-0 bottom-0 w-3 flex flex-col items-center pointer-events-none"
        aria-hidden="true"
      >
        {/* 上方線段 — 連到上一個 entry 的 dot */}
        <div className="h-[18px] w-px bg-border" />
        {/* Dot */}
        <div className="h-3 w-3 rounded-full bg-primary shrink-0" />
        {/* 下方線段 — 延伸到下一個 entry */}
        {!isLast && <div className="flex-1 w-px bg-border" />}
      </div>

      {/* 日期標題 — 收斂版編輯排版 */}
      <header className="flex items-center gap-3 mb-5">
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
        className="tiptap-container"
        dangerouslySetInnerHTML={{ __html: cleanHTML }}
      />
    </article>
  );
}

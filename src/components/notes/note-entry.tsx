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
      {/* 時間軸線條 */}
      {!isLast && (
        <div
          className="absolute left-[1.4rem] md:left-[1.65rem] top-5 bottom-0 w-px bg-border"
          aria-hidden="true"
        />
      )}

      {/* 時間軸圓點 */}
      <div
        className="absolute left-[0.95rem] md:left-[1.2rem] top-2 flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="h-2.5 w-2.5 rounded-full bg-border-light ring-2 ring-background" />
      </div>

      {/* 日期標題 */}
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-3xl font-extrabold leading-none text-foreground/50 tabular-nums">
          {dayNum}
        </span>
        <div className="flex flex-col -space-y-0.5">
          <span className="text-xs font-medium text-text-dim leading-tight">{month}</span>
          <span className="text-xs text-text-dim/60 leading-tight">{weekday}</span>
        </div>
      </div>

      {/* 筆記內容 */}
      <div
        className="tiptap-container"
        dangerouslySetInnerHTML={{ __html: cleanHTML }}
      />
    </article>
  );
}

"use client";

import { Link } from "@/i18n/routing";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { List } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { fetcher } from "@/lib/fetcher";
import { NotesCanvasEditor } from "./notes-canvas-editor";

interface NotesCanvasProps {
  date: string;
  isToday: boolean;
}

export function NotesCanvas({ date, isToday }: NotesCanvasProps) {
  const t = useTranslations("notes");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const { data, isLoading } = useSWR<{ content: string }>(
    `/api/daily/${date}/notes`,
    fetcher
  );

  const d = parseISO(date);
  const dateLabel = format(d, "M/d · EEEE", { locale: dateFnsLocale });
  const fullLabel = isToday
    ? `${format(d, "M/d")} · ${tCommon("today")}`
    : dateLabel;

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 mb-8">
        <h1 className="text-column-title text-foreground shrink-0">{tNav("notes")}</h1>
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-column-title text-text-dim tabular-nums truncate">
            {fullLabel}
          </span>
          <Link
            href="/notes/feed"
            aria-label={t("canvasToggleFeedAria")}
            title={t("canvasToggleFeedTitle")}
            className="text-text-dim hover:text-foreground transition-colors p-2 -mr-2 shrink-0"
          >
            <List className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Canvas editor */}
      {isLoading ? (
        <div className="min-h-[60vh] animate-pulse" />
      ) : (
        <NotesCanvasEditor date={date} initialContent={data?.content || ""} />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { ResizeHandle } from "@/components/ui/resize-handle";
import { DailyCardsPanel } from "@/components/daily/daily-cards-panel";
import { CardDetail } from "@/components/cards/card-detail";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { CalendarEventItem } from "@/components/calendar/calendar-event-item";
import { CalendarEmptyState } from "@/components/calendar/calendar-empty-state";
import { EventPopover } from "@/components/calendar/event-popover";

export type RightPanelKind = "calendar" | "cards" | "detail";

const MIN_WIDTH = 280;
const MAX_WIDTH = 720;

interface DailyRightPanelProps {
  kind: RightPanelKind;
  width: number;
  onWidthChange: (px: number) => void;
  date: string; // YYYY-MM-DD — forwarded to calendar content
  detailId?: string | null;
  onBackFromDetail?: () => void;
  onOpenCard?: (id: string) => void;
}

export function DailyRightPanel({
  kind,
  width,
  onWidthChange,
  date,
  detailId,
  onBackFromDetail,
  onOpenCard,
}: DailyRightPanelProps) {
  const tNav = useTranslations("nav");
  return (
    <aside
      aria-label={kind === "calendar" ? tNav("calendar") : tNav("cards")}
      className="fixed right-0 top-0 bottom-0 z-30 hidden lg:flex border-l border-border bg-background"
      style={{ width }}
    >
      {/* Drag handle on the left edge — dragging left grows the panel */}
      <ResizeHandle
        value={width}
        onChange={onWidthChange}
        min={MIN_WIDTH}
        max={MAX_WIDTH}
        side="left"
      />

      {/* Content area — pt 讓出頂部帶狀區，避開固定在右上的 toolbar（對齊 Mac 標題列在內容上方） */}
      <div className="flex-1 overflow-hidden h-full pt-10">
        {kind === "detail" && detailId ? (
          <div className="h-full overflow-y-auto">
            <CardDetail id={detailId} embedded onBack={onBackFromDetail} />
          </div>
        ) : kind === "calendar" ? (
          <CalendarContent date={date} />
        ) : (
          <DailyCardsPanel onOpenCard={onOpenCard} />
        )}
      </div>
    </aside>
  );
}

// ── Inline calendar content ───────────────────────────────────────────────
// CalendarPanel (calendar-panel.tsx) renders its own `fixed` aside wrapper
// which conflicts with this panel's positioning. We inline the content here
// using the same hook and subcomponents — no wrapper duplication.
function CalendarContent({ date }: { date: string }) {
  const t = useTranslations("calendar");
  const { data, error, isLoading, refresh } = useCalendarEvents(date);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-6 pb-3 shrink-0">
        <div className="text-[16px] font-semibold tracking-tight text-foreground">
          {t("panelTitle")}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
        {data && data.connected === false && data.reason !== "reauth_required" && (
          <CalendarEmptyState variant="not_connected" />
        )}
        {data && data.connected === false && data.reason === "reauth_required" && (
          <CalendarEmptyState variant="reauth" />
        )}
        {error && !data && (
          <CalendarEmptyState variant="error" onRetry={refresh} />
        )}
        {isLoading && !data && (
          <div
            role="status"
            aria-busy="true"
            aria-label={t("panelLoading")}
            className="flex justify-center py-16"
          >
            <div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground/40 animate-spin" />
            <span className="sr-only">{t("panelLoading")}</span>
          </div>
        )}
        {data && data.connected && data.events.length === 0 && (
          <CalendarEmptyState variant="empty" />
        )}
        {data && data.connected && data.events.length > 0 && (
          <div className="space-y-2">
            {data.events.map((e) => {
              const past = new Date(e.end).getTime() < now && !e.allDay;
              const key = `${e.calendarId}-${e.id}`;
              return (
                <EventPopover key={key} event={e}>
                  <CalendarEventItem event={e} past={past} />
                </EventPopover>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

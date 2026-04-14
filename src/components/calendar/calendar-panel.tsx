"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { CalendarEventItem } from "./calendar-event-item";
import { CalendarEmptyState } from "./calendar-empty-state";

interface Props {
  date: string; // YYYY-MM-DD
}

export function CalendarPanel({ date }: Props) {
  const t = useTranslations("calendar");
  const { data, error, isLoading, refresh } = useCalendarEvents(date);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const now = Date.now();

  return (
    <aside
      aria-label={t("panelTitle")}
      className="hidden md:flex fixed left-14 top-0 bottom-0 z-30 w-[260px] flex-col border-r border-border bg-background"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <div className="text-sm font-semibold text-foreground">{t("panelTitle")}</div>
          <div className="text-xs text-text-dim">Google Calendar</div>
        </div>
        <button
          type="button"
          onClick={refresh}
          aria-label={t("panelRefresh")}
          title={t("panelRefresh")}
          className="rounded-md p-1 text-text-dim hover:bg-surface-hover hover:text-foreground"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
        {/* Not connected */}
        {data && data.connected === false && data.reason !== "reauth_required" && (
          <CalendarEmptyState variant="not_connected" />
        )}
        {data && data.connected === false && data.reason === "reauth_required" && (
          <CalendarEmptyState variant="reauth" />
        )}

        {/* Error */}
        {error && !data && <CalendarEmptyState variant="error" onRetry={refresh} />}

        {/* Loading skeleton */}
        {isLoading && !data && (
          <>
            <div className="h-12 rounded-md bg-muted animate-pulse" />
            <div className="h-12 rounded-md bg-muted animate-pulse" />
            <div className="h-12 rounded-md bg-muted animate-pulse" />
          </>
        )}

        {/* Connected with events */}
        {data && data.connected && data.events.length === 0 && (
          <CalendarEmptyState variant="empty" />
        )}

        {data && data.connected && data.events.length > 0 && (
          <div className="space-y-2">
            {data.events.map((e) => {
              const past = new Date(e.end).getTime() < now && !e.allDay;
              return (
                <CalendarEventItem
                  key={`${e.calendarId}-${e.id}`}
                  event={e}
                  past={past}
                  expanded={expandedId === `${e.calendarId}-${e.id}`}
                  onToggle={() =>
                    setExpandedId((cur) =>
                      cur === `${e.calendarId}-${e.id}` ? null : `${e.calendarId}-${e.id}`
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
  // Tick every minute so past-event dimming stays fresh without
  // reading Date.now() during render (which React Compiler flags as impure).
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside
      aria-label={t("panelTitle")}
      className="hidden lg:flex fixed left-14 top-0 bottom-0 z-30 w-[300px] flex-col bg-background"
    >
      <div className="px-4 pt-6 pb-3">
        <div className="text-[16px] font-semibold tracking-tight text-foreground">
          {t("panelTitle")}
        </div>
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
          <div role="status" aria-busy="true" aria-label={t("panelLoading")} className="space-y-2">
            <div className="h-12 rounded-md bg-muted animate-pulse" />
            <div className="h-12 rounded-md bg-muted animate-pulse" />
            <div className="h-12 rounded-md bg-muted animate-pulse" />
            <span className="sr-only">{t("panelLoading")}</span>
          </div>
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

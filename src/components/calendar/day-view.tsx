"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CalendarEvent } from "@/lib/google-calendar/types";
import { CalendarNav } from "./calendar-nav";
import { CalendarEventItem } from "./calendar-event-item";

interface Props {
  date: string;
  onDateChange: (d: string) => void;
  eventsByDate: Map<string, CalendarEvent[]>;
  isLoading: boolean;
}

interface Section {
  key: "allDay" | "morning" | "afternoon" | "evening";
  labelKey: string | null; // null = 全天 (no header)
  events: CalendarEvent[];
}

function getHour(event: CalendarEvent): number {
  return new Date(event.start).getHours();
}

function sortByStart(a: CalendarEvent, b: CalendarEvent): number {
  return new Date(a.start).getTime() - new Date(b.start).getTime();
}

export function CalendarDayView({ date, onDateChange, eventsByDate, isLoading }: Props) {
  const t = useTranslations("calendar");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dayEvents: CalendarEvent[] = eventsByDate.get(date) ?? [];

  // Build period sections
  const allDay = dayEvents.filter((e) => e.allDay).sort(sortByStart);
  const morning = dayEvents.filter((e) => !e.allDay && getHour(e) < 12).sort(sortByStart);
  const afternoon = dayEvents.filter((e) => !e.allDay && getHour(e) >= 12 && getHour(e) < 18).sort(sortByStart);
  const evening = dayEvents.filter((e) => !e.allDay && getHour(e) >= 18).sort(sortByStart);

  // 先給字面量 Section[] 上下文再 filter — annotation 直接套在 .filter()
  // 結果上時，內層字面量會失去 contextual typing、key 被推寬成 string。
  const allSections: Section[] = [
    { key: "allDay",    labelKey: null,              events: allDay    },
    { key: "morning",   labelKey: "morning",         events: morning   },
    { key: "afternoon", labelKey: "afternoon",       events: afternoon },
    { key: "evening",   labelKey: "evening",         events: evening   },
  ];
  const sections = allSections.filter((s) => s.events.length > 0);

  const hasEvents = dayEvents.length > 0;
  const showLoading = isLoading && !hasEvents;

  const toggleExpand = (key: string) => {
    setExpandedId((cur) => (cur === key ? null : key));
  };

  return (
    <div className="pt-3 space-y-4">
      {/* Week strip nav */}
      <CalendarNav date={date} onDateChange={onDateChange} />

      {/* Loading state */}
      {showLoading && (
        <div role="status" aria-busy="true" aria-label={t("panelLoading")} className="space-y-2 pt-2">
          <div className="h-14 rounded-md bg-muted animate-pulse" />
          <div className="h-14 rounded-md bg-muted animate-pulse" />
          <div className="h-14 rounded-md bg-muted animate-pulse" />
          <span className="sr-only">{t("panelLoading")}</span>
        </div>
      )}

      {/* Empty state */}
      {!showLoading && !hasEvents && (
        <div className="py-16 text-center text-empty-state text-text-dim">
          {t("panelEmpty")}
        </div>
      )}

      {/* Events grouped by period */}
      {!showLoading && hasEvents && (
        <div className="space-y-4">
          {sections.map((section) => {
            const uniqueKey = (e: CalendarEvent) => `${e.calendarId}-${e.id}`;
            return (
              <div key={section.key} className="space-y-1.5">
                {/* Section header — skip for allDay */}
                {section.labelKey !== null && (
                  <h3 className="text-section-header text-text-dim px-1">
                    {t(section.labelKey as Parameters<typeof t>[0])}
                  </h3>
                )}

                {/* Events */}
                <div className="space-y-1.5">
                  {section.events.map((e) => {
                    const eKey = uniqueKey(e);
                    const past = !e.allDay && new Date(e.end).getTime() < now;
                    return (
                      <CalendarEventItem
                        key={eKey}
                        event={e}
                        expanded={expandedId === eKey}
                        onToggle={() => toggleExpand(eKey)}
                        past={past}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

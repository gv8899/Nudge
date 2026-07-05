"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import type { CalendarEvent } from "@/lib/google-calendar/types";

interface Props extends React.ComponentPropsWithoutRef<"button"> {
  event: CalendarEvent;
  past: boolean;
}

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Horizontal two-column event row (time | title+location), aligned with
 * Mac's `CalendarDayView.eventCard` layout. Renders a single `<button>` as
 * root so it can be used directly as an `EventPopover` trigger (Base UI's
 * `render` prop clones this element and merges click/ref props onto it —
 * requires forwardRef).
 */
export const CalendarEventItem = React.forwardRef<HTMLButtonElement, Props>(
  function CalendarEventItem({ event, past, className, ...rest }, ref) {
    const t = useTranslations("calendar");
    const timeColor = past ? "text-text-dim" : "text-foreground";
    const titleColor = past ? "text-text-dim" : "text-foreground";
    const cardBg = past ? "bg-foreground/[0.02]" : "bg-foreground/[0.04]";
    const ariaTime = event.allDay
      ? t("eventAllDay")
      : `${formatHHMM(event.start)} – ${formatHHMM(event.end)}`;

    return (
      <button
        type="button"
        ref={ref}
        aria-label={`${ariaTime} ${event.title}`}
        className={`flex w-full items-start gap-3 rounded-lg ${cardBg} px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset ${className ?? ""}`}
        {...rest}
      >
        {/* Time column */}
        <div className={`w-16 shrink-0 text-column-title tabular-nums ${timeColor}`}>
          {/* Mac eventCard 只顯示開始時間（CalendarDayView.swift）；結束時間留給 popover */}
          {event.allDay ? t("eventAllDay") : formatHHMM(event.start)}
        </div>

        {/* Title + location column */}
        <div className="min-w-0 flex-1">
          <div className={`line-clamp-2 text-row-title-em ${titleColor}`} title={event.title}>
            {event.title}
          </div>
          {event.location && (
            <div className="mt-1 flex items-center gap-1 text-row-body text-text-dim">
              <MapPin size={13} className="shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
        </div>
      </button>
    );
  }
);

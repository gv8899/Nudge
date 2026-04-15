"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, ChevronDown, ChevronUp, MapPin, Video } from "lucide-react";
import type { CalendarEvent } from "@/lib/google-calendar/types";

interface Props {
  event: CalendarEvent;
  expanded: boolean;
  onToggle: () => void;
  past: boolean;
}

function formatTimeRange(start: string, end: string, allDay: boolean, allDayLabel: string): string {
  if (allDay) return allDayLabel;
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export function CalendarEventItem({ event, expanded, onToggle, past }: Props) {
  const t = useTranslations("calendar");
  const timeLabel = formatTimeRange(event.start, event.end, event.allDay, t("eventAllDay"));
  const canExpand = !event.busyOnly;
  // Dim title/location color for past events instead of container opacity
  // to avoid compound contrast failure on already-dim text tokens.
  const titleColor = past ? "text-text-dim" : "text-foreground";
  const subtitleColor = past ? "text-text-faint" : "text-text-dim";

  return (
    <div className="rounded-md border border-border bg-card text-sm">
      <button
        type="button"
        onClick={canExpand ? onToggle : undefined}
        className={`w-full px-3 py-2 text-left flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset rounded-md ${
          canExpand ? "cursor-pointer hover:bg-surface-hover" : "cursor-default"
        }`}
        aria-expanded={canExpand ? expanded : undefined}
      >
        <div className="flex-1 min-w-0">
          <div className={`text-xs ${subtitleColor}`}>{timeLabel}</div>
          <div className={`truncate ${titleColor}`} title={event.title}>
            {event.title}
          </div>
          {event.location && (
            <div className={`mt-0.5 flex items-center gap-1 text-xs ${subtitleColor}`}>
              <MapPin size={10} className="shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
        </div>
        {canExpand && (
          <span className={subtitleColor}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </button>

      {canExpand && expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2 text-xs">
          {event.location && (
            <div>
              <div className="uppercase tracking-wide text-text-faint text-xs font-medium">
                {t("eventLocation")}
              </div>
              <div className="text-foreground">{event.location}</div>
            </div>
          )}
          {event.attendees.length > 0 && (
            <div>
              <div className="uppercase tracking-wide text-text-faint text-xs font-medium">
                {t("eventAttendees")}
              </div>
              <div className="text-foreground">{event.attendees.join(" · ")}</div>
            </div>
          )}
          {event.description && (
            <div>
              <div className="uppercase tracking-wide text-text-faint text-xs font-medium">
                {t("eventDescription")}
              </div>
              <div className="text-text-dim whitespace-pre-wrap line-clamp-6">
                {event.description}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1 pt-1">
            {event.hangoutLink && (
              <a
                href={event.hangoutLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1 rounded text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Video size={12} />
                {t("eventJoinMeet")}
              </a>
            )}
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1 rounded text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <ExternalLink size={12} />
                {t("eventOpenInGoogle")}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

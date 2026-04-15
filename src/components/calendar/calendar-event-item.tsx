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

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function CalendarEventItem({ event, expanded, onToggle, past }: Props) {
  const t = useTranslations("calendar");
  const canExpand = !event.busyOnly;
  const titleColor = past ? "text-text-faint" : "text-text-dim";
  const timeColor = past ? "text-text-dim" : "text-foreground";
  const locationColor = past ? "text-text-faint" : "text-text-dim";
  const dashColor = past ? "text-text-faint" : "text-primary/70";
  const ariaTime = event.allDay
    ? t("eventAllDay")
    : `${formatHHMM(event.start)} – ${formatHHMM(event.end)}`;

  return (
    <div className="rounded-md bg-card text-sm">
      <button
        type="button"
        onClick={canExpand ? onToggle : undefined}
        className={`w-full text-left px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset rounded-md ${
          canExpand ? "cursor-pointer hover:bg-surface-hover" : "cursor-default"
        }`}
        aria-expanded={canExpand ? expanded : undefined}
        aria-label={`${ariaTime} ${event.title}`}
      >
        {/* Row 1: 時段 — hero moment，最大字重 */}
        <div className="flex items-baseline justify-between gap-2">
          {event.allDay ? (
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${timeColor}`}
            >
              {t("eventAllDay")}
            </span>
          ) : (
            <div className="flex items-baseline gap-1.5 tabular-nums">
              <span className={`text-[17px] font-semibold leading-none ${timeColor}`}>
                {formatHHMM(event.start)}
              </span>
              <span className={`text-[13px] leading-none ${dashColor}`}>—</span>
              <span className={`text-[11px] leading-none ${past ? "text-text-faint" : "text-text-dim"}`}>
                {formatHHMM(event.end)}
              </span>
            </div>
          )}
          {canExpand && (
            <span className={`shrink-0 ${past ? "text-text-faint" : "text-text-dim"}`}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          )}
        </div>

        {/* Row 2: 標題 — 降階到 supporting cast */}
        <div
          className={`mt-1.5 truncate text-[12.5px] leading-snug ${titleColor}`}
          title={event.title}
        >
          {event.title}
        </div>

        {/* Row 3: 地點 */}
        {event.location && (
          <div className={`mt-1 flex items-center gap-1 text-[10.5px] ${locationColor}`}>
            <MapPin size={9} className="shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
      </button>

      {canExpand && expanded && (
        <div className="border-t border-border/60 px-3 py-2.5 space-y-2.5 text-xs">
          {event.location && (
            <div>
              <div className="uppercase tracking-[0.12em] text-text-faint text-[10px] font-semibold">
                {t("eventLocation")}
              </div>
              <div className="mt-0.5 text-foreground leading-snug">{event.location}</div>
            </div>
          )}
          {event.attendees.length > 0 && (
            <div>
              <div className="uppercase tracking-[0.12em] text-text-faint text-[10px] font-semibold">
                {t("eventAttendees")}
                <span className="ml-1 normal-case tracking-normal">
                  · {event.attendees.length}
                </span>
              </div>
              <div className="mt-0.5 text-foreground leading-relaxed">
                {event.attendees.join(" · ")}
              </div>
            </div>
          )}
          {event.description && (
            <div>
              <div className="uppercase tracking-[0.12em] text-text-faint text-[10px] font-semibold">
                {t("eventDescription")}
              </div>
              <div className="mt-0.5 text-text-dim whitespace-pre-wrap line-clamp-6 leading-snug">
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
                className="inline-flex w-fit items-center gap-1.5 rounded text-primary font-medium hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
                className="inline-flex w-fit items-center gap-1.5 rounded text-primary font-medium hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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

"use client";

import * as React from "react";
import { Calendar, MapPin, Video, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CalendarEvent } from "@/lib/google-calendar/types";

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface Props {
  event: CalendarEvent;
  /** The anchor/trigger element — must be a single React element (e.g. a <button>). */
  children: React.ReactElement;
}

export function EventPopover({ event, children }: Props) {
  const t = useTranslations("calendar");

  const timeLabel = event.allDay
    ? t("eventAllDay")
    : `${formatHHMM(event.start)} – ${formatHHMM(event.end)}`;

  const visibleAttendees = event.attendees.slice(0, 6);
  const overflowAttendees = event.attendees.length - visibleAttendees.length;

  return (
    <Popover>
      <PopoverTrigger render={children} />
      <PopoverContent
        className="w-[380px] max-w-[90vw] p-0 overflow-hidden"
        side="bottom"
        align="start"
        sideOffset={6}
      >
        <div className="flex flex-col gap-3 p-4">
          {/* Time */}
          <div className="text-xs font-mono tabular-nums text-text-dim">
            {timeLabel}
          </div>

          {/* Title */}
          <div className="text-sm font-semibold leading-snug text-foreground">
            {event.title}
          </div>

          {/* Google Meet join button */}
          {event.hangoutLink && (
            <a
              href={event.hangoutLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-medium"
            >
              <Video size={14} className="shrink-0" />
              {t("eventJoinMeet")}
            </a>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-1.5 text-xs text-text-dim">
              <MapPin size={13} className="mt-0.5 shrink-0" />
              <span className="leading-snug">{event.location}</span>
            </div>
          )}

          {/* Calendar name */}
          {event.calendarName && (
            <div className="flex items-center gap-1.5 text-xs text-text-dim">
              <Calendar size={13} className="shrink-0" />
              <span className="truncate">{event.calendarName}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="text-xs text-text-dim whitespace-pre-wrap line-clamp-6 leading-snug">
              {event.description}
            </div>
          )}

          {/* Attendees */}
          {event.attendees.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                {t("eventAttendees")}
                <span className="ml-1 normal-case tracking-normal font-normal">
                  · {event.attendees.length}
                </span>
              </div>
              <div className="text-xs text-text-dim leading-relaxed">
                {visibleAttendees.join(" · ")}
                {overflowAttendees > 0 && (
                  <span className="text-text-faint"> +{overflowAttendees}</span>
                )}
              </div>
            </div>
          )}

          {/* Footer: open in Google */}
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
            >
              <ExternalLink size={12} />
              {t("eventOpenInGoogle")}
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

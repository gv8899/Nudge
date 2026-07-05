"use client";

import * as React from "react";
import { Calendar, MapPin, Video } from "lucide-react";
import { format } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { useTranslations, useLocale } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CalendarEvent } from "@/lib/google-calendar/types";

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface Props {
  event: CalendarEvent;
  /** The trigger element — must be a single React element (e.g. a <button>). */
  children: React.ReactElement;
}

/**
 * 事件詳情 — 對齊 Mac DailyHostView.eventDetailOverlay：**置中 modal**
 * （580×520、rounded 16、黑 30% backdrop、無 X，點外面 / Esc 關閉），
 * 不是錨定 popover。內容排版鏡像 CalendarEventDetailSheet：時間列 →
 * 標題 → 滿版加入會議鈕 → 地點/日曆 rows → 備註 section → 與會者。
 */
export function EventPopover({ event, children }: Props) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const dfLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const datePrefix = format(
    new Date(event.start),
    locale === "en" ? "MMM d EEE" : "M月d日 EEE",
    { locale: dfLocale }
  );

  const timeLabel = event.allDay
    ? `${datePrefix} · ${t("eventAllDay")}`
    : `${datePrefix} · ${formatHHMM(event.start)} – ${formatHHMM(event.end)}`;

  return (
    <Dialog>
      <DialogTrigger render={children} />
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[580px] h-[520px] max-h-[85dvh] p-0 rounded-2xl overflow-hidden block"
      >
        <div className="h-full overflow-y-auto">
          <div className="flex flex-col items-start gap-5 p-5">
            {/* 時間 + 標題 */}
            <div className="space-y-2">
              <div className="text-row-meta-em tabular-nums text-foreground/70">
                {timeLabel}
              </div>
              <DialogTitle className="text-column-detail-title leading-snug text-foreground">
                {event.title}
              </DialogTitle>
            </div>

            {/* Google Meet join button — 滿版主色（對齊 Mac joinMeetingButton） */}
            {event.hangoutLink && (
              <a
                href={event.hangoutLink}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-3 text-inline-button hover:opacity-90 transition-opacity"
              >
                <Video size={16} className="shrink-0" />
                {t("eventJoinMeet")}
              </a>
            )}

            {/* 地點 */}
            {event.location && (
              <div className="flex items-start gap-2.5 text-row-title">
                <MapPin size={16} className="mt-0.5 w-5 shrink-0 text-text-dim" />
                <span className="leading-snug text-foreground">{event.location}</span>
              </div>
            )}

            {/* 所屬日曆 */}
            {event.calendarName && (
              <div className="flex items-center gap-2.5 text-row-title">
                <Calendar size={16} className="w-5 shrink-0 text-text-dim" />
                <span className="truncate text-foreground">{event.calendarName}</span>
              </div>
            )}

            {/* 備註 */}
            {event.description && (
              <div className="space-y-2">
                <div className="text-row-meta-em text-foreground">
                  {t("eventDescription")}
                </div>
                <div className="text-row-title text-foreground whitespace-pre-wrap leading-relaxed">
                  {event.description}
                </div>
              </div>
            )}

            {/* 與會者 — 小圓點 rows（對齊 Mac attendeeRow） */}
            {event.attendees.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-row-meta-em text-foreground">
                  {t("eventAttendees")} ({event.attendees.length})
                </div>
                <div className="space-y-1.5">
                  {event.attendees.map((a) => (
                    <div key={a} className="flex items-center gap-2.5 text-row-title text-foreground">
                      <span className="flex w-5 justify-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-text-dim/80" />
                      </span>
                      {a}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

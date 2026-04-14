/** 後端回給前端的統一事件 shape */
export interface CalendarEvent {
  id: string;
  calendarId: string;
  calendarName: string;
  title: string;
  /** ISO string in event's timezone */
  start: string;
  /** ISO string in event's timezone */
  end: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
  attendees: string[];
  /** Google Calendar 事件網頁連結 */
  htmlLink: string;
  /** Google Meet / Hangout 連結，無則空字串 */
  hangoutLink: string;
  /** 是否為 private / busy-only（沒有細節可顯示） */
  busyOnly: boolean;
}

/** 後端回給前端的日曆清單 item */
export interface CalendarListItem {
  id: string;
  summary: string;
  backgroundColor: string | null;
  primary: boolean;
}

/** /api/calendar/events response */
export type EventsResponse =
  | { connected: true; events: CalendarEvent[] }
  | { connected: false; reason?: "reauth_required" };

/** /api/calendar/calendars GET response */
export interface CalendarsResponse {
  calendars: CalendarListItem[];
  selectedIds: string[];
}

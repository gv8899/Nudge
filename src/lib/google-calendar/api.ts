import type { CalendarEvent, CalendarListItem } from "./types";

const BASE = "https://www.googleapis.com/calendar/v3";

async function callGoogle<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** 留空函式以維持 disconnect route 對此呼叫的相容性（未來若加回 People API 再啟用） */
export function clearNameMapCache(_userId: string) {
  // no-op
}

interface GoogleCalendarListResp {
  items: Array<{
    id: string;
    summary: string;
    backgroundColor?: string;
    primary?: boolean;
    accessRole?: string;
  }>;
}

export async function listCalendars(
  accessToken: string
): Promise<CalendarListItem[]> {
  const json = await callGoogle<GoogleCalendarListResp>(
    accessToken,
    "/users/me/calendarList?minAccessRole=reader"
  );
  return (json.items || [])
    // 只保留使用者「擁有」的日曆（primary + 使用者自建的），
    // 排除從同事/組織訂閱的個人日曆（accessRole: reader）
    .filter((c) => c.accessRole === "owner")
    .map((c) => ({
      id: c.id,
      summary: c.summary,
      backgroundColor: c.backgroundColor || null,
      primary: c.primary === true,
    }));
}

interface GoogleEventsResp {
  items: Array<{
    id: string;
    status?: string;
    summary?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    location?: string;
    description?: string;
    attendees?: Array<{ email?: string; displayName?: string; self?: boolean; organizer?: boolean }>;
    htmlLink?: string;
    hangoutLink?: string;
    visibility?: string;
  }>;
}

/** 把 email 轉成較友善的暱稱（取 @ 前面的部分，dot/underscore 換空格） */
function emailToNickname(email: string): string {
  const local = email.split("@")[0] || email;
  return local.replace(/[._]+/g, " ");
}

export async function listEvents(
  accessToken: string,
  calendarId: string,
  calendarName: string,
  timeMinIso: string,
  timeMaxIso: string
): Promise<CalendarEvent[]> {
  const qs = new URLSearchParams({
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
    showDeleted: "false",
  });
  const json = await callGoogle<GoogleEventsResp>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${qs}`
  );

  return (json.items || [])
    .filter((e) => e.status !== "cancelled")
    .map((e) => {
      const allDay = !!e.start?.date && !e.start?.dateTime;
      const start = e.start?.dateTime ?? e.start?.date ?? "";
      const end = e.end?.dateTime ?? e.end?.date ?? "";
      const busyOnly = e.visibility === "private" || e.visibility === "confidential";
      return {
        id: e.id,
        calendarId,
        calendarName,
        title: busyOnly ? "忙碌" : e.summary ?? "(No title)",
        start,
        end,
        allDay,
        location: busyOnly ? null : e.location ?? null,
        description: busyOnly ? null : e.description ?? null,
        attendees: busyOnly
          ? []
          : (e.attendees ?? [])
              .filter((a) => !a.self) // 把自己過濾掉
              .map((a) => a.displayName || (a.email ? emailToNickname(a.email) : ""))
              .filter(Boolean),
        htmlLink: e.htmlLink ?? "",
        hangoutLink: e.hangoutLink ?? "",
        busyOnly,
      };
    });
}

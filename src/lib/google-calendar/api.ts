import type { CalendarEvent, CalendarListItem } from "./types";

const BASE = "https://www.googleapis.com/calendar/v3";
const PEOPLE_BASE = "https://people.googleapis.com/v1";

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

async function callPeople<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${PEOPLE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`People API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

interface DirectoryPersonResp {
  people?: Array<{
    names?: Array<{ displayName?: string; unstructuredName?: string }>;
    emailAddresses?: Array<{ value?: string }>;
  }>;
  nextPageToken?: string;
}

/**
 * 取得使用者 Workspace directory 裡所有人的 email→顯示名稱 對照表。
 * 用來補齊 Calendar API 沒給 displayName 的 attendee。
 */
export async function fetchDirectoryNameMap(
  accessToken: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let pageToken: string | undefined;
  // 最多抓 3 頁（3000 人）避免大公司拖慢 response
  for (let page = 0; page < 3; page++) {
    const qs = new URLSearchParams({
      readMask: "names,emailAddresses",
      sources: "DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE",
      pageSize: "1000",
    });
    if (pageToken) qs.set("pageToken", pageToken);
    const json = await callPeople<DirectoryPersonResp>(
      accessToken,
      `/people:listDirectoryPeople?${qs}`
    );
    for (const p of json.people ?? []) {
      const name =
        p.names?.[0]?.displayName || p.names?.[0]?.unstructuredName || "";
      if (!name) continue;
      for (const e of p.emailAddresses ?? []) {
        if (e.value) map.set(e.value.toLowerCase(), name);
      }
    }
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return map;
}

interface GoogleCalendarListResp {
  items: Array<{
    id: string;
    summary: string;
    backgroundColor?: string;
    primary?: boolean;
  }>;
}

export async function listCalendars(
  accessToken: string
): Promise<CalendarListItem[]> {
  const json = await callGoogle<GoogleCalendarListResp>(
    accessToken,
    "/users/me/calendarList?minAccessRole=reader"
  );
  return (json.items || []).map((c) => ({
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

export interface ListEventsOptions {
  /** 用來補齊 Google Calendar 沒給 displayName 的 attendee */
  directoryNameMap?: Map<string, string>;
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
  timeMaxIso: string,
  options: ListEventsOptions = {}
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
              .map((a) => {
                if (a.displayName) return a.displayName;
                if (a.email) {
                  const fromDir = options.directoryNameMap?.get(a.email.toLowerCase());
                  if (fromDir) return fromDir;
                  return emailToNickname(a.email);
                }
                return "";
              })
              .filter(Boolean),
        htmlLink: e.htmlLink ?? "",
        hangoutLink: e.hangoutLink ?? "",
        busyOnly,
      };
    });
}

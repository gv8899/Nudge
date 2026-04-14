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

interface PeopleConnectionsResp {
  connections?: Array<{
    names?: Array<{ displayName?: string; unstructuredName?: string }>;
    emailAddresses?: Array<{ value?: string }>;
  }>;
  nextPageToken?: string;
}

interface OtherContactsResp {
  otherContacts?: Array<{
    names?: Array<{ displayName?: string; unstructuredName?: string }>;
    emailAddresses?: Array<{ value?: string }>;
  }>;
  nextPageToken?: string;
}

function mergeInto(
  map: Map<string, string>,
  people: Array<{
    names?: Array<{ displayName?: string; unstructuredName?: string }>;
    emailAddresses?: Array<{ value?: string }>;
  }>
) {
  for (const p of people) {
    const name = p.names?.[0]?.displayName || p.names?.[0]?.unstructuredName || "";
    if (!name) continue;
    for (const e of p.emailAddresses ?? []) {
      if (e.value && !map.has(e.value.toLowerCase())) {
        map.set(e.value.toLowerCase(), name);
      }
    }
  }
}

// In-memory cache per user for People API name map (rarely changes)
const NAME_MAP_TTL_MS = 15 * 60 * 1000;
const nameMapCache = new Map<string, { map: Map<string, string>; expiresAt: number }>();

/**
 * 組合多個 People API 來源建 email→顯示名稱對照表。
 * 依優先序：Workspace directory → 使用者聯絡人 → 其他聯絡人（自動記錄的）。
 * 任何一支失敗都不會擋主流程，只會少一些名字。
 * 每個 userId 會 cache 15 分鐘避免重複打 People API。
 */
export async function fetchDirectoryNameMap(
  accessToken: string,
  userId: string
): Promise<Map<string, string>> {
  const cached = nameMapCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.map;
  }
  const map = await buildNameMap(accessToken);
  nameMapCache.set(userId, { map, expiresAt: Date.now() + NAME_MAP_TTL_MS });
  return map;
}

/** Disconnect / re-auth 時呼叫，清掉使用者的 name map cache */
export function clearNameMapCache(userId: string) {
  nameMapCache.delete(userId);
}

async function buildNameMap(accessToken: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  // 1) Workspace directory（只有 Workspace 帳號可用）
  try {
    let pageToken: string | undefined;
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
      mergeInto(map, json.people ?? []);
      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
    }
  } catch (e) {
    console.warn("listDirectoryPeople failed:", e);
  }

  // 2) 使用者聯絡人
  try {
    let pageToken: string | undefined;
    for (let page = 0; page < 3; page++) {
      const qs = new URLSearchParams({
        personFields: "names,emailAddresses",
        pageSize: "1000",
      });
      if (pageToken) qs.set("pageToken", pageToken);
      const json = await callPeople<PeopleConnectionsResp>(
        accessToken,
        `/people/me/connections?${qs}`
      );
      mergeInto(map, json.connections ?? []);
      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
    }
  } catch (e) {
    console.warn("listConnections failed:", e);
  }

  // 3) 其他聯絡人（Google 自動記錄的）
  try {
    let pageToken: string | undefined;
    for (let page = 0; page < 3; page++) {
      const qs = new URLSearchParams({
        readMask: "names,emailAddresses",
        pageSize: "1000",
      });
      if (pageToken) qs.set("pageToken", pageToken);
      const json = await callPeople<OtherContactsResp>(
        accessToken,
        `/otherContacts?${qs}`
      );
      mergeInto(map, json.otherContacts ?? []);
      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
    }
  } catch (e) {
    console.warn("listOtherContacts failed:", e);
  }

  return map;
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

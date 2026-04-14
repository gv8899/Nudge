import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAccessToken } from "@/lib/google-calendar/tokens";
import { listEvents, listCalendars } from "@/lib/google-calendar/api";
import type { EventsResponse, CalendarEvent } from "@/lib/google-calendar/types";

function computeDayRange(dateStr: string, tz: string): { min: string; max: string } {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) throw new Error("Invalid date");
  const [y, m, d] = parts;
  const startLocal = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${y}-${pad(m)}-${pad(d)}`;
  const tzOffset = getTzOffsetString(tz, startLocal);
  return {
    min: `${ymd}T00:00:00${tzOffset}`,
    max: `${ymd}T23:59:59${tzOffset}`,
  };
}

function getTzOffsetString(tz: string, date: Date): string {
  // Returns e.g. "+08:00" for Asia/Taipei
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  });
  const parts = dtf.formatToParts(date);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+00:00";
  const match = offsetPart.match(/GMT([+-]\d{2}:\d{2})?/);
  return match?.[1] || "+00:00";
}

export async function GET(req: NextRequest): Promise<NextResponse<EventsResponse | { error: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateStr = req.nextUrl.searchParams.get("date");
  const tz = req.nextUrl.searchParams.get("tz") || "UTC";
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const tokenResult = await getAccessToken(session.user.id);
  if (tokenResult.status === "not_connected") {
    return NextResponse.json({ connected: false } as EventsResponse);
  }
  if (tokenResult.status === "reauth_required") {
    return NextResponse.json({ connected: false, reason: "reauth_required" } as EventsResponse);
  }

  let range: { min: string; max: string };
  try {
    range = computeDayRange(dateStr, tz);
  } catch {
    return NextResponse.json({ error: "Invalid date/tz" }, { status: 400 });
  }

  // 先取得子日曆清單（需要名稱供 event 填充）
  let allCalendars;
  try {
    allCalendars = await listCalendars(tokenResult.accessToken);
  } catch (e) {
    console.error("listCalendars failed:", e);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const nameMap = new Map(allCalendars.map((c) => [c.id, c.summary]));

  const results = await Promise.allSettled(
    tokenResult.selectedIds.map((id) =>
      listEvents(tokenResult.accessToken, id, nameMap.get(id) || id, range.min, range.max)
    )
  );

  const events: CalendarEvent[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      events.push(...r.value);
    } else {
      console.error("listEvents failed:", r.reason);
    }
  }
  // 如果每個都失敗，回 500
  if (events.length === 0 && results.every((r) => r.status === "rejected")) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  // 依開始時間排序，all-day 先排
  events.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.start.localeCompare(b.start);
  });

  // 用 primary calendar 的 id（它就是日曆擁有者的 email）組 AccountChooser URL，
  // 這樣即使 Nudge 登入的 Google 帳號 ≠ 日曆連結的 Google 帳號也能正確開啟
  const primaryCal = allCalendars.find((c) => c.primary);
  const calendarEmail = primaryCal?.id || session.user.email || undefined;
  if (calendarEmail) {
    for (const e of events) {
      if (e.htmlLink) {
        const sepA = e.htmlLink.includes("?") ? "&" : "?";
        const withAuth = `${e.htmlLink}${sepA}authuser=${encodeURIComponent(calendarEmail)}`;
        e.htmlLink =
          `https://accounts.google.com/AccountChooser?` +
          `Email=${encodeURIComponent(calendarEmail)}` +
          `&continue=${encodeURIComponent(withAuth)}`;
      }
    }
  }

  return NextResponse.json({ connected: true, events } as EventsResponse);
}

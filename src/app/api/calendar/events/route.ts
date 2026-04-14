import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAccessToken } from "@/lib/google-calendar/tokens";
import { listEvents, listCalendars, fetchDirectoryNameMap } from "@/lib/google-calendar/api";
import type { EventsResponse, CalendarEvent } from "@/lib/google-calendar/types";

function computeRange(
  startDate: string,
  endDate: string,
  tz: string
): { min: string; max: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const sp = startDate.split("-").map(Number);
  const ep = endDate.split("-").map(Number);
  if (sp.length !== 3 || ep.length !== 3) throw new Error("Invalid date");
  const startLocal = new Date(Date.UTC(sp[0], sp[1] - 1, sp[2], 0, 0, 0));
  const endLocal = new Date(Date.UTC(ep[0], ep[1] - 1, ep[2], 0, 0, 0));
  const startTzOffset = getTzOffsetString(tz, startLocal);
  const endTzOffset = getTzOffsetString(tz, endLocal);
  const sYmd = `${sp[0]}-${pad(sp[1])}-${pad(sp[2])}`;
  const eYmd = `${ep[0]}-${pad(ep[1])}-${pad(ep[2])}`;
  return {
    min: `${sYmd}T00:00:00${startTzOffset}`,
    max: `${eYmd}T23:59:59${endTzOffset}`,
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
  const endDateStr = req.nextUrl.searchParams.get("endDate") || dateStr;
  const tz = req.nextUrl.searchParams.get("tz") || "UTC";
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!endDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
    return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
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
    range = computeRange(dateStr, endDateStr, tz);
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

  // 只 fetch 在 allowed list 裡的 selectedIds（listCalendars 已過濾過），
  // 避免使用者殘留的非 owner 日曆 id 被拿來抓 Google
  const allowedSelectedIds = tokenResult.selectedIds.filter((id) => nameMap.has(id));

  // 並行抓 Workspace directory 做 email→姓名查表（失敗不影響主流程）
  let directoryNameMap: Map<string, string> | undefined;
  try {
    directoryNameMap = await fetchDirectoryNameMap(tokenResult.accessToken, session.user.id);
  } catch (e) {
    console.warn("fetchDirectoryNameMap failed (attendees will fall back to email):", e);
  }

  const results = await Promise.allSettled(
    allowedSelectedIds.map((id) =>
      listEvents(tokenResult.accessToken, id, nameMap.get(id) || id, range.min, range.max, {
        directoryNameMap,
      })
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

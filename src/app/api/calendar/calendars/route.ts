import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAccessToken } from "@/lib/google-calendar/tokens";
import { listCalendars } from "@/lib/google-calendar/api";
import type { CalendarsResponse } from "@/lib/google-calendar/types";

export async function GET(): Promise<NextResponse<CalendarsResponse | { error: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getAccessToken(session.user.id);
  if (token.status !== "ok") {
    return NextResponse.json({ error: token.status }, { status: 400 });
  }

  try {
    const calendars = await listCalendars(token.accessToken);
    return NextResponse.json({
      calendars,
      selectedIds: token.selectedIds,
    });
  } catch (e) {
    console.error("listCalendars failed:", e);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!Array.isArray(body.selectedIds)) {
    return NextResponse.json({ error: "selectedIds must be an array" }, { status: 400 });
  }
  const ids: string[] = body.selectedIds.filter((x: unknown) => typeof x === "string");

  await db
    .update(users)
    .set({ googleCalendarSelectedIds: JSON.stringify(ids) })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ selectedIds: ids });
}

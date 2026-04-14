import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { clearNameMapCache } from "@/lib/google-calendar/api";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(users)
    .set({
      googleCalendarAccessToken: null,
      googleCalendarRefreshToken: null,
      googleCalendarTokenExpires: null,
      googleCalendarSelectedIds: null,
    })
    .where(eq(users.id, session.user.id));

  clearNameMapCache(session.user.id);

  return NextResponse.json({ connected: false });
}

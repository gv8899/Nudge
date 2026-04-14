import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { clearNameMapCache } from "@/lib/google-calendar/api";

export async function POST() {
  const user = await getUser();
  if (!user) {
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
    .where(eq(users.id, user.id));

  clearNameMapCache(user.id);

  return NextResponse.json({ connected: false });
}

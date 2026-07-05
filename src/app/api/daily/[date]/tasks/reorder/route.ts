import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyTaskAssignments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import { notifyUserDevices } from "@/lib/notify-devices";

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { order } = body as { order: { id: string; sortOrder: number }[] };

  const nowIso = new Date().toISOString();
  for (const item of order) {
    await db.update(dailyTaskAssignments)
      .set({ sortOrder: item.sortOrder, updatedAt: nowIso })
      .where(eq(dailyTaskAssignments.id, item.id));
  }

  notifyUserDevices(user.id);
  return NextResponse.json({ success: true });
}

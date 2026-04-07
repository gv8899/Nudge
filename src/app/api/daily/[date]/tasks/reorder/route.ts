import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyTaskAssignments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { order } = body as { order: { id: string; sortOrder: number }[] };

  for (const item of order) {
    db.update(dailyTaskAssignments)
      .set({ sortOrder: item.sortOrder })
      .where(eq(dailyTaskAssignments.id, item.id))
      .run();
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyTaskAssignments, tasks } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

/**
 * PATCH /api/daily-assignments/[id] — 更新單筆 assignment 的 isSkipped /
 * isCompleted / sortOrder。
 *
 * 所有權檢查走 task → user 的 join；assignment 本身不直接帶 userId。
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [row] = await db
    .select({ assignmentId: dailyTaskAssignments.id })
    .from(dailyTaskAssignments)
    .innerJoin(tasks, eq(tasks.id, dailyTaskAssignments.taskId))
    .where(and(eq(dailyTaskAssignments.id, id), eq(tasks.userId, user.id)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.isSkipped !== undefined) updates.isSkipped = !!body.isSkipped;
  if (body.isCompleted !== undefined) updates.isCompleted = !!body.isCompleted;
  if (body.sortOrder !== undefined) updates.sortOrder = Number(body.sortOrder);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No-op" }, { status: 400 });
  }

  await db
    .update(dailyTaskAssignments)
    .set(updates)
    .where(eq(dailyTaskAssignments.id, id));

  const [updated] = await db
    .select()
    .from(dailyTaskAssignments)
    .where(eq(dailyTaskAssignments.id, id))
    .limit(1);
  return NextResponse.json(updated);
}

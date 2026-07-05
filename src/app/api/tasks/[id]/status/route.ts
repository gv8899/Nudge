import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, statusHistory } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TASK_STATUS_LIST } from "@/lib/constants";
import { getUser } from "@/lib/get-user";
import { notifyUserDevices } from "@/lib/notify-devices";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const newStatus = body.status;

  if (!TASK_STATUS_LIST.includes(newStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();

  await db.update(tasks)
    .set({
      status: newStatus,
      updatedAt: now,
      completedAt: newStatus === "done" ? now : null,
    })
    .where(eq(tasks.id, id));

  await db.insert(statusHistory)
    .values({
      id: nanoid(),
      taskId: id,
      fromStatus: existing.status,
      toStatus: newStatus,
      changedAt: now,
      note: body.note || null,
    });

  const [updated] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  notifyUserDevices(user.id);
  return NextResponse.json(updated);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const history = await db
    .select()
    .from(statusHistory)
    .where(eq(statusHistory.taskId, id))
    .orderBy(statusHistory.changedAt);

  return NextResponse.json(history);
}

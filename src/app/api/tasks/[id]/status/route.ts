import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, statusHistory } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TASK_STATUS_LIST } from "@/lib/constants";
import { getUser } from "@/lib/get-user";

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

  const existing = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
    .get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();

  db.update(tasks)
    .set({
      status: newStatus,
      updatedAt: now,
      completedAt: newStatus === "done" ? now : null,
    })
    .where(eq(tasks.id, id))
    .run();

  db.insert(statusHistory)
    .values({
      id: nanoid(),
      taskId: id,
      fromStatus: existing.status,
      toStatus: newStatus,
      changedAt: now,
      note: body.note || null,
    })
    .run();

  const updated = db.select().from(tasks).where(eq(tasks.id, id)).get();
  return NextResponse.json(updated);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const history = db
    .select()
    .from(statusHistory)
    .where(eq(statusHistory.taskId, id))
    .orderBy(statusHistory.changedAt)
    .all();

  return NextResponse.json(history);
}

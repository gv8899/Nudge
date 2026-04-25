import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, tags, taskTags } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
    .limit(1);

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const taskTagRows = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(taskTags)
    .innerJoin(tags, eq(tags.id, taskTags.tagId))
    .where(eq(taskTags.taskId, id));

  return NextResponse.json({ ...task, tags: taskTagRows });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const now = new Date().toISOString();

  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.remindAt !== undefined) updates.remindAt = body.remindAt;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

  await db.update(tasks).set(updates).where(eq(tasks.id, id));

  const [updated] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));
  return NextResponse.json({ success: true });
}

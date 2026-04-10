import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, statusHistory } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getUser } from "@/lib/get-user";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let result;
  if (status) {
    result = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, user.id), eq(tasks.status, status as any)))
      .orderBy(tasks.sortOrder);
  } else {
    result = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, user.id))
      .orderBy(tasks.sortOrder);
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const now = new Date().toISOString();
  const id = nanoid();

  const task = {
    id,
    userId: user.id,
    title: body.title,
    description: body.description || null,
    status: body.status || "inbox",
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    remindAt: body.remindAt || null,
    sortOrder: body.sortOrder || 0,
  };

  await db.insert(tasks).values(task);

  await db.insert(statusHistory)
    .values({
      id: nanoid(),
      taskId: id,
      fromStatus: null,
      toStatus: task.status,
      changedAt: now,
      note: null,
    });

  return NextResponse.json(task, { status: 201 });
}

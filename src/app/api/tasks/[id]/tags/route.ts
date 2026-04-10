import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, taskTags } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const task = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
    .get();

  if (!task)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const tagIds: string[] = body.tagIds || [];

  db.delete(taskTags).where(eq(taskTags.taskId, id)).run();

  for (const tagId of tagIds) {
    db.insert(taskTags).values({ taskId: id, tagId }).run();
  }

  return NextResponse.json({ tagIds });
}

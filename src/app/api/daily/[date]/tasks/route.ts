import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyTaskAssignments, tasks, statusHistory } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getUser } from "@/lib/get-user";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = await params;
  const body = await request.json();
  const now = new Date().toISOString();

  let taskId = body.taskId;

  if (!taskId && body.title) {
    taskId = nanoid();
    const status = body.status || "in_progress";
    await db.insert(tasks)
      .values({
        id: taskId,
        userId: user.id,
        title: body.title,
        description: body.description || null,
        status,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        remindAt: null,
        sortOrder: 0,
      });

    await db.insert(statusHistory)
      .values({
        id: nanoid(),
        taskId,
        fromStatus: null,
        toStatus: status,
        changedAt: now,
        note: null,
      });
  }

  const [existing] = await db
    .select()
    .from(dailyTaskAssignments)
    .where(
      and(
        eq(dailyTaskAssignments.taskId, taskId),
        eq(dailyTaskAssignments.date, date)
      )
    )
    .limit(1);

  if (existing) return NextResponse.json(existing);

  const assignment = {
    id: nanoid(),
    taskId,
    date,
    isCompleted: false,
    sortOrder: body.sortOrder || 0,
  };

  await db.insert(dailyTaskAssignments).values(assignment);
  return NextResponse.json(assignment, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  await db.delete(dailyTaskAssignments)
    .where(eq(dailyTaskAssignments.id, body.assignmentId));
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { assignmentId, isCompleted, sortOrder, moveToDate } = body;

  if (moveToDate && assignmentId) {
    const [existing] = await db
      .select()
      .from(dailyTaskAssignments)
      .where(eq(dailyTaskAssignments.id, assignmentId))
      .limit(1);

    if (existing) {
      const [alreadyExists] = await db
        .select()
        .from(dailyTaskAssignments)
        .where(
          and(
            eq(dailyTaskAssignments.taskId, existing.taskId),
            eq(dailyTaskAssignments.date, moveToDate)
          )
        )
        .limit(1);

      if (!alreadyExists) {
        await db.insert(dailyTaskAssignments)
          .values({
            id: nanoid(),
            taskId: existing.taskId,
            date: moveToDate,
            isCompleted: false,
            sortOrder: 0,
          });
      }

      await db.update(dailyTaskAssignments)
        .set({ isCompleted: true })
        .where(eq(dailyTaskAssignments.id, assignmentId));
    }

    return NextResponse.json({ success: true });
  }

  const updates: Record<string, unknown> = {};
  if (isCompleted !== undefined) updates.isCompleted = isCompleted;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;

  await db.update(dailyTaskAssignments)
    .set(updates)
    .where(eq(dailyTaskAssignments.id, assignmentId));

  if (isCompleted === true && body.taskId) {
    const now = new Date().toISOString();
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, body.taskId))
      .limit(1);

    if (task && task.status !== "done") {
      await db.update(tasks)
        .set({ status: "done", updatedAt: now, completedAt: now })
        .where(eq(tasks.id, body.taskId));

      await db.insert(statusHistory)
        .values({
          id: nanoid(),
          taskId: body.taskId,
          fromStatus: task.status,
          toStatus: "done",
          changedAt: now,
          note: "透過打勾完成",
        });
    }
  }

  return NextResponse.json({ success: true });
}

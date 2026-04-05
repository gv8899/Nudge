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
    db.insert(tasks)
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
      })
      .run();

    db.insert(statusHistory)
      .values({
        id: nanoid(),
        taskId,
        fromStatus: null,
        toStatus: status,
        changedAt: now,
        note: null,
      })
      .run();
  }

  const existing = db
    .select()
    .from(dailyTaskAssignments)
    .where(
      and(
        eq(dailyTaskAssignments.taskId, taskId),
        eq(dailyTaskAssignments.date, date)
      )
    )
    .get();

  if (existing) return NextResponse.json(existing);

  const assignment = {
    id: nanoid(),
    taskId,
    date,
    isCompleted: false,
    sortOrder: body.sortOrder || 0,
  };

  db.insert(dailyTaskAssignments).values(assignment).run();
  return NextResponse.json(assignment, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  db.delete(dailyTaskAssignments)
    .where(eq(dailyTaskAssignments.id, body.assignmentId))
    .run();
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { assignmentId, isCompleted, sortOrder, moveToDate } = body;

  if (moveToDate && assignmentId) {
    const existing = db
      .select()
      .from(dailyTaskAssignments)
      .where(eq(dailyTaskAssignments.id, assignmentId))
      .get();

    if (existing) {
      const alreadyExists = db
        .select()
        .from(dailyTaskAssignments)
        .where(
          and(
            eq(dailyTaskAssignments.taskId, existing.taskId),
            eq(dailyTaskAssignments.date, moveToDate)
          )
        )
        .get();

      if (!alreadyExists) {
        db.insert(dailyTaskAssignments)
          .values({
            id: nanoid(),
            taskId: existing.taskId,
            date: moveToDate,
            isCompleted: false,
            sortOrder: 0,
          })
          .run();
      }

      db.delete(dailyTaskAssignments)
        .where(eq(dailyTaskAssignments.id, assignmentId))
        .run();
    }

    return NextResponse.json({ success: true });
  }

  const updates: Record<string, unknown> = {};
  if (isCompleted !== undefined) updates.isCompleted = isCompleted;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;

  db.update(dailyTaskAssignments)
    .set(updates)
    .where(eq(dailyTaskAssignments.id, assignmentId))
    .run();

  if (isCompleted === true && body.taskId) {
    const now = new Date().toISOString();
    const task = db
      .select()
      .from(tasks)
      .where(eq(tasks.id, body.taskId))
      .get();

    if (task && task.status !== "done") {
      db.update(tasks)
        .set({ status: "done", updatedAt: now, completedAt: now })
        .where(eq(tasks.id, body.taskId))
        .run();

      db.insert(statusHistory)
        .values({
          id: nanoid(),
          taskId: body.taskId,
          fromStatus: task.status,
          toStatus: "done",
          changedAt: now,
          note: "透過打勾完成",
        })
        .run();
    }
  }

  return NextResponse.json({ success: true });
}

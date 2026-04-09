import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyTaskAssignments, dailyNotes, tasks } from "@/lib/db/schema";
import { eq, and, lt, ne } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = await params;

  const assignments = db
    .select({
      id: dailyTaskAssignments.id,
      taskId: dailyTaskAssignments.taskId,
      date: dailyTaskAssignments.date,
      isCompleted: dailyTaskAssignments.isCompleted,
      sortOrder: dailyTaskAssignments.sortOrder,
      task: {
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        completedAt: tasks.completedAt,
        remindAt: tasks.remindAt,
        sortOrder: tasks.sortOrder,
      },
    })
    .from(dailyTaskAssignments)
    .innerJoin(tasks, eq(dailyTaskAssignments.taskId, tasks.id))
    .where(
      and(
        eq(dailyTaskAssignments.date, date),
        eq(tasks.userId, user.id),
        ne(tasks.status, "archived")
      )
    )
    .orderBy(dailyTaskAssignments.sortOrder)
    .all();

  const overdueTasks = db
    .select({
      id: dailyTaskAssignments.id,
      taskId: dailyTaskAssignments.taskId,
      date: dailyTaskAssignments.date,
      isCompleted: dailyTaskAssignments.isCompleted,
      sortOrder: dailyTaskAssignments.sortOrder,
      task: {
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        completedAt: tasks.completedAt,
        remindAt: tasks.remindAt,
        sortOrder: tasks.sortOrder,
      },
    })
    .from(dailyTaskAssignments)
    .innerJoin(tasks, eq(dailyTaskAssignments.taskId, tasks.id))
    .where(
      and(
        lt(dailyTaskAssignments.date, date),
        eq(dailyTaskAssignments.isCompleted, false),
        eq(tasks.userId, user.id),
        ne(tasks.status, "archived")
      )
    )
    .orderBy(dailyTaskAssignments.date)
    .all();

  const note = db
    .select()
    .from(dailyNotes)
    .where(
      and(eq(dailyNotes.date, date), eq(dailyNotes.userId, user.id))
    )
    .get();

  return NextResponse.json({
    date,
    assignments,
    overdueTasks,
    noteContent: note?.content || "",
  });
}

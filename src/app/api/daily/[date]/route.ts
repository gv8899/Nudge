import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  dailyTaskAssignments,
  dailyNotes,
  tasks,
  taskRecurrences,
} from "@/lib/db/schema";
import { eq, and, lt, ne, sql } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import { occurs, type RecurrenceRule } from "@/lib/recurrence";
import { nanoid } from "nanoid";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = await params;

  // 1. Lazy materialize: 對該 user 所有 active recurrences 算 occurs(date)，
  //    把符合條件且尚未 materialize 的 INSERT 進來。ON CONFLICT 防雙寫。
  const userRecurrences = await db
    .select({
      taskId: taskRecurrences.taskId,
      preset: taskRecurrences.preset,
      weekdays: taskRecurrences.weekdays,
      monthDay: taskRecurrences.monthDay,
      monthNth: taskRecurrences.monthNth,
      monthNthWeekday: taskRecurrences.monthNthWeekday,
      startDate: taskRecurrences.startDate,
      endDate: taskRecurrences.endDate,
    })
    .from(taskRecurrences)
    .innerJoin(tasks, eq(tasks.id, taskRecurrences.taskId))
    .where(
      and(eq(tasks.userId, user.id), ne(tasks.status, "archived")),
    );

  for (const rec of userRecurrences) {
    if (rec.endDate && rec.endDate < date) continue;
    if (rec.startDate > date) continue;
    const rule: RecurrenceRule = {
      preset: rec.preset,
      weekdays: rec.weekdays,
      monthDay: rec.monthDay,
      monthNth: rec.monthNth,
      monthNthWeekday: rec.monthNthWeekday,
      startDate: rec.startDate,
      endDate: rec.endDate,
    };
    if (occurs(date, rule)) {
      await db
        .insert(dailyTaskAssignments)
        .values({
          id: nanoid(),
          taskId: rec.taskId,
          date,
          isCompleted: false,
          isSkipped: false,
          sortOrder: 0,
        })
        .onConflictDoNothing();
    }
  }

  // 2. 撈該日 assignments (含 isRecurring 標記，給 UI 顯示「跳過這次」menu)
  const assignments = await db
    .select({
      id: dailyTaskAssignments.id,
      taskId: dailyTaskAssignments.taskId,
      date: dailyTaskAssignments.date,
      isCompleted: dailyTaskAssignments.isCompleted,
      isSkipped: dailyTaskAssignments.isSkipped,
      sortOrder: dailyTaskAssignments.sortOrder,
      isRecurring: sql<boolean>`(${taskRecurrences.id} IS NOT NULL)`,
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
    .leftJoin(
      taskRecurrences,
      eq(taskRecurrences.taskId, tasks.id),
    )
    .where(
      and(
        eq(dailyTaskAssignments.date, date),
        eq(dailyTaskAssignments.isSkipped, false),
        eq(tasks.userId, user.id),
        ne(tasks.status, "archived"),
      ),
    )
    .orderBy(dailyTaskAssignments.sortOrder);

  const overdueTasks = await db
    .select({
      id: dailyTaskAssignments.id,
      taskId: dailyTaskAssignments.taskId,
      date: dailyTaskAssignments.date,
      isCompleted: dailyTaskAssignments.isCompleted,
      isSkipped: dailyTaskAssignments.isSkipped,
      sortOrder: dailyTaskAssignments.sortOrder,
      isRecurring: sql<boolean>`(${taskRecurrences.id} IS NOT NULL)`,
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
    .leftJoin(
      taskRecurrences,
      eq(taskRecurrences.taskId, tasks.id),
    )
    .where(
      and(
        lt(dailyTaskAssignments.date, date),
        eq(dailyTaskAssignments.isCompleted, false),
        eq(dailyTaskAssignments.isSkipped, false),
        eq(tasks.userId, user.id),
        ne(tasks.status, "archived"),
      ),
    )
    .orderBy(dailyTaskAssignments.date);

  const [note] = await db
    .select()
    .from(dailyNotes)
    .where(and(eq(dailyNotes.date, date), eq(dailyNotes.userId, user.id)))
    .limit(1);

  return NextResponse.json({
    date,
    assignments,
    overdueTasks,
    noteContent: note?.content || "",
  });
}

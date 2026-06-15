import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
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
import { stripFractionalSecondsDeep } from "@/lib/strip-ms";

export async function GET(
  request: NextRequest,
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
          updatedAt: new Date().toISOString(),
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
      assignmentUpdatedAt: dailyTaskAssignments.updatedAt,
      isRecurring: sql<boolean>`(${taskRecurrences.id} IS NOT NULL)`,
      // hasReminder：一次性提醒看 tasks.remind_at；重複任務的提醒存在
      // recurrence 的 remind_at_time_of_day。任一有值就算「有提醒」。
      hasReminder: sql<boolean>`(${tasks.remindAt} IS NOT NULL OR ${taskRecurrences.remindAtTimeOfDay} IS NOT NULL)`,
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
      assignmentUpdatedAt: dailyTaskAssignments.updatedAt,
      isRecurring: sql<boolean>`(${taskRecurrences.id} IS NOT NULL)`,
      // hasReminder：一次性提醒看 tasks.remind_at；重複任務的提醒存在
      // recurrence 的 remind_at_time_of_day。任一有值就算「有提醒」。
      hasReminder: sql<boolean>`(${tasks.remindAt} IS NOT NULL OR ${taskRecurrences.remindAtTimeOfDay} IS NOT NULL)`,
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

  // ETag — weak hash of logical state for this date. 變動就變、沒變動
  // 回 304 + 空 body 短路。
  //
  // 採 max(assignment.updatedAt) 而非 task.updatedAt：勾/解勾 / 跳過 /
  // 排序 / 移日只動 daily_task_assignments，不會 bump tasks.updatedAt，
  // 用後者會漏抓變動（過去的 bug：「前幾天」勾掉沒消失、4/27 解勾後今天
  // overdue 沒重現）。assignment.updatedAt 由 PATCH endpoints 統一維護。
  //
  // Note 用 content.length 而非 updatedAt 因為 dailyNotes schema 沒有
  // updatedAt 欄位（schema.ts:86）。Note length 必須是獨立 component —
  // 直接丟進 max(...timestamps) 會被毫秒級數字完全淹沒，note 改了
  // ETag 不會變、client 拿不到更新。
  //
  // **Recurrence**：response 帶 `isRecurring`（來自 leftJoin task_recurrences），
  // 但 recurrence add/delete 不動 daily_task_assignments → maxUpdated 不變
  // → ETag 不變 → 304 假陽性 → client 拿不到新 isRecurring。fix：把
  // user 範圍內 recurrences 的 max(updatedAt) + count 也 fold 進 etagSource。
  // count 處理「刪除最新」與「刪除非最新」兩種 case（max 可能不變但 count
  // 變）。
  const allUpdatedAts: number[] = [];
  for (const a of assignments) {
    allUpdatedAts.push(new Date(a.assignmentUpdatedAt).getTime());
  }
  for (const a of overdueTasks) {
    allUpdatedAts.push(new Date(a.assignmentUpdatedAt).getTime());
  }
  const maxUpdated = allUpdatedAts.length > 0 ? Math.max(...allUpdatedAts) : 0;
  const noteLength = note?.content?.length ?? 0;
  const [recurrenceStats] = await db
    .select({
      maxUpdated: sql<string | null>`MAX(${taskRecurrences.updatedAt})`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(taskRecurrences)
    .innerJoin(tasks, eq(taskRecurrences.taskId, tasks.id))
    .where(eq(tasks.userId, user.id));
  const recurrenceMaxUpdated = recurrenceStats?.maxUpdated
    ? new Date(recurrenceStats.maxUpdated).getTime()
    : 0;
  const recurrenceCount = recurrenceStats?.count ?? 0;
  // tasks.updated_at 也 fold 進來 — response 帶 task.title / description /
  // remind_at（hasReminder 來源之一）等欄位，但這些只 bump tasks.updated_at
  // 不動 daily_task_assignments。沒這項的話改 title / 設一次性提醒後 client
  // 會吃到 304 stale。只在這日 / overdue 出現的 task 範圍內取 max。
  const taskUpdatedAts = [...assignments, ...overdueTasks].map((a) =>
    new Date(a.task.updatedAt).getTime(),
  );
  const tasksMaxUpdated = taskUpdatedAts.length > 0 ? Math.max(...taskUpdatedAts) : 0;
  const etagSource = `${date}|${maxUpdated}|${assignments.length}|${overdueTasks.length}|${noteLength}|${recurrenceMaxUpdated}|${recurrenceCount}|${tasksMaxUpdated}`;
  const etag = `W/"${createHash("md5").update(etagSource).digest("hex")}"`;

  // Honor If-None-Match — 一致就回 304，不送 body
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "no-cache",
      },
    });
  }

  return NextResponse.json(
    // 去毫秒：相容舊版 macOS app 的嚴格 .iso8601 decoder（見 strip-ms.ts）。
    stripFractionalSecondsDeep({
      date,
      assignments,
      overdueTasks,
      noteContent: note?.content || "",
    }),
    {
      headers: {
        ETag: etag,
        "Cache-Control": "no-cache",
      },
    }
  );
}

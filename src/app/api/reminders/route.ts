import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, taskRecurrences } from "@/lib/db/schema";
import { and, eq, isNotNull, ne, or } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

/**
 * GET /api/reminders — 該使用者「所有設了提醒的任務」清單。
 *
 * 本機推播通知是 per-device 的：在 Mac 設的提醒只有 Mac 排了鬧鐘，
 * iPhone 不會知道。每台裝置改成啟動 / 回前景時呼叫這支 API，把回傳
 * 的清單整批重排本機通知，就能讓兩邊（之後多裝置也一樣）都收到。
 *
 * 收錄條件：絕對提醒 (tasks.remindAt) 或重複提醒
 * (taskRecurrences.remindAtTimeOfDay) 至少有一個，且任務未封存 / 未完成
 * （那兩種狀態不該再響）。recurrence 直接回完整 row，對應 Apple 端的
 * TaskRecurrenceDTO。
 */
export async function GET() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({ task: tasks, recurrence: taskRecurrences })
    .from(tasks)
    .leftJoin(taskRecurrences, eq(taskRecurrences.taskId, tasks.id))
    .where(
      and(
        eq(tasks.userId, user.id),
        ne(tasks.status, "archived"),
        ne(tasks.status, "done"),
        or(
          isNotNull(tasks.remindAt),
          isNotNull(taskRecurrences.remindAtTimeOfDay),
        ),
      ),
    );

  const reminders = rows.map((r) => ({
    taskId: r.task.id,
    title: r.task.title,
    remindAt: r.task.remindAt,
    recurrence: r.recurrence ?? null,
  }));

  return NextResponse.json(reminders);
}

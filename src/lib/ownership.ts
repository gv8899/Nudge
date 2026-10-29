// API 共用的資料擁有者檢查。daily_task_assignments / task_tags 本身沒有 userId，
// 擁有者要經 tasks / tags 的 userId 判斷 —— 少了這一步，知道別人 ID 的人就能
// 改到別人的資料。新增吃 ID 的 route 時一律先過這裡。

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyTaskAssignments, tags, tasks } from "@/lib/db/schema";

export async function ownsTask(userId: string, taskId: string): Promise<boolean> {
  const [t] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  return !!t;
}

/** assignment 屬於此使用者 → 回它的 taskId；否則 null。 */
export async function ownedAssignmentTaskId(
  userId: string,
  assignmentId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ taskId: dailyTaskAssignments.taskId })
    .from(dailyTaskAssignments)
    .innerJoin(tasks, eq(tasks.id, dailyTaskAssignments.taskId))
    .where(and(eq(dailyTaskAssignments.id, assignmentId), eq(tasks.userId, userId)))
    .limit(1);
  return row?.taskId ?? null;
}

/** 這批 assignment 是否全部屬於此使用者（空陣列 = true）。 */
export async function ownsAllAssignments(userId: string, ids: string[]): Promise<boolean> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return true;
  const rows = await db
    .select({ id: dailyTaskAssignments.id })
    .from(dailyTaskAssignments)
    .innerJoin(tasks, eq(tasks.id, dailyTaskAssignments.taskId))
    .where(and(inArray(dailyTaskAssignments.id, unique), eq(tasks.userId, userId)));
  return rows.length === unique.length;
}

/** 這批 tag 是否全部屬於此使用者（空陣列 = true）。 */
export async function ownsAllTags(userId: string, tagIds: string[]): Promise<boolean> {
  const unique = [...new Set(tagIds)];
  if (unique.length === 0) return true;
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(tags.id, unique)));
  return rows.length === unique.length;
}

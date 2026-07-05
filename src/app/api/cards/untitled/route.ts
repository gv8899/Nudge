import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import { notifyUserDevices } from "@/lib/notify-devices";

/**
 * DELETE /api/cards/untitled
 * 刪除所有標題為空或只有空白的任務（清理未命名的卡片）。
 * 回傳刪除數量。
 */
export async function DELETE() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 取所有任務並在 JS 端過濾（SQL 無法直接處理「trim 後為空」）
  const allUserTasks = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(eq(tasks.userId, user.id));

  const idsToDelete = allUserTasks
    .filter((t) => !t.title || t.title.trim() === "")
    .map((t) => t.id);

  if (idsToDelete.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  // 逐筆刪除（cascade 會自動清掉 dailyTaskAssignments / statusHistory 等）
  for (const id of idsToDelete) {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  notifyUserDevices(user.id);
  return NextResponse.json({ deleted: idsToDelete.length });
}

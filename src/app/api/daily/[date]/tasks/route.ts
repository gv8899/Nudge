import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyTaskAssignments, tasks, statusHistory } from "@/lib/db/schema";
import { eq, and, lt, ne, min } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getUser } from "@/lib/get-user";
import { notifyUserDevices } from "@/lib/notify-devices";

async function getTopSortOrder(date: string) {
  const [row] = await db
    .select({ minOrder: min(dailyTaskAssignments.sortOrder) })
    .from(dailyTaskAssignments)
    .where(eq(dailyTaskAssignments.date, date));
  return (row?.minOrder ?? 0) - 1;
}

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

  const topOrder = await getTopSortOrder(date);
  const assignment = {
    id: nanoid(),
    taskId,
    date,
    isCompleted: false,
    sortOrder: topOrder,
    updatedAt: new Date().toISOString(),
  };

  await db.insert(dailyTaskAssignments).values(assignment);
  notifyUserDevices(user.id);
  return NextResponse.json(assignment, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  await db.delete(dailyTaskAssignments)
    .where(eq(dailyTaskAssignments.id, body.assignmentId));
  notifyUserDevices(user.id);
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

      const topOrder = await getTopSortOrder(moveToDate);
      const nowIso = new Date().toISOString();
      if (alreadyExists) {
        // 目標日期已有 assignment，確保為未完成、未 skip、排到最上方。
        // is_skipped 也清成 false：若 user 之前把目標日 skip 過 (例如以前
        // 從這天移走過)，現在重新 move 回來要可見。
        await db.update(dailyTaskAssignments)
          .set({
            isCompleted: false,
            isSkipped: false,
            sortOrder: topOrder,
            updatedAt: nowIso,
          })
          .where(eq(dailyTaskAssignments.id, alreadyExists.id));
      } else {
        await db.insert(dailyTaskAssignments)
          .values({
            id: nanoid(),
            taskId: existing.taskId,
            date: moveToDate,
            isCompleted: false,
            sortOrder: topOrder,
            updatedAt: nowIso,
          });
      }

      // 把原始 assignment 設成 is_skipped=true (墓碑) 而非 DELETE。
      //
      // 為什麼：對「重複 task」，DELETE 後下次 GET /api/daily/{原日} 時
      // lazy materialize 看 recurrence 規則 → 該日應該出現 + 沒對應 row
      // → ON CONFLICT 不擋，再 INSERT 一筆全新 row → 同一個 task 同時
      // 在原日 + 目標日各有一筆，user 就看到「移完還是有」的 dup。
      //
      // 改成 is_skipped=true 之後：
      //   - 顯示用的 query 已經 filter `is_skipped = false`，原日不會顯示
      //   - lazy materialize 用 ON CONFLICT DO NOTHING，看到 (task,日)
      //     已有 row 就 skip → 不會被重生
      //   - 跟「跳過這次」menu 共用同一個欄位，語意一致
      await db.update(dailyTaskAssignments)
        .set({ isSkipped: true, updatedAt: nowIso })
        .where(eq(dailyTaskAssignments.id, assignmentId));

      // Roll up：把同一 task 所有「比目標日早 + 還沒完成 + 還沒 skip」
      // 的 assignment 也一併 skip。
      //
      // Why：user move 一筆過去日 task 到今天/未來，語意是「我今天會
      // catch up 這個 task」。若 task 在過去多日有殘留 (例如 weekly
      // recurring 多次未完成、或之前 chain move 卡住的 row)，只 skip
      // 點擊那筆會留下其他 dup 顯示在「前幾天」清單。一次清完使用者
      // 才不用一筆一筆點。
      //
      // 邏輯：date < moveToDate AND task_id 同 AND 不是已處理的 source
      // /target AND 還沒完成 AND 還沒 skip (避免重複 bump updated_at)。
      await db.update(dailyTaskAssignments)
        .set({ isSkipped: true, updatedAt: nowIso })
        .where(
          and(
            eq(dailyTaskAssignments.taskId, existing.taskId),
            lt(dailyTaskAssignments.date, moveToDate),
            eq(dailyTaskAssignments.isCompleted, false),
            eq(dailyTaskAssignments.isSkipped, false),
            ne(dailyTaskAssignments.id, assignmentId),
          )
        );
    }

    notifyUserDevices(user.id);
    return NextResponse.json({ success: true });
  }

  const updates: Record<string, unknown> = {};
  if (isCompleted !== undefined) updates.isCompleted = isCompleted;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date().toISOString();
    await db.update(dailyTaskAssignments)
      .set(updates)
      .where(eq(dailyTaskAssignments.id, assignmentId));
  }

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

  notifyUserDevices(user.id);
  return NextResponse.json({ success: true });
}

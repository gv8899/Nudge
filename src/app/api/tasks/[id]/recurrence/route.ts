import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  tasks,
  taskRecurrences,
  dailyTaskAssignments,
} from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import {
  occurs,
  assignmentsToReap,
  type RecurrenceRule,
} from "@/lib/recurrence";
import { nanoid } from "nanoid";
import { notifyUserDevices } from "@/lib/notify-devices";

async function ownsTask(taskId: string, userId: string): Promise<boolean> {
  const [t] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  return !!t;
}

/** GET /api/tasks/[id]/recurrence — 該 task 目前的 recurrence rule，沒設過時回 null */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await ownsTask(id, user.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [rec] = await db
    .select()
    .from(taskRecurrences)
    .where(eq(taskRecurrences.taskId, id))
    .limit(1);
  return NextResponse.json(rec ?? null);
}

/**
 * PUT /api/tasks/[id]/recurrence — upsert recurrence rule。
 * Body 同 schema 對應欄位 (preset/weekdays/monthDay/monthNth/
 * monthNthWeekday/startDate/endDate/remindAtTimeOfDay)。
 *
 * 副作用：若新規則 occurs(today)，同步 materialize 今天的 assignment，
 * 讓使用者立刻在行動頁看到 (避免「設好了但今天沒出現」的困惑)。
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: taskId } = await params;
  if (!(await ownsTask(taskId, user.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const now = new Date().toISOString();

  const payload = {
    preset: body.preset,
    weekdays: body.weekdays ?? null,
    monthDay: body.monthDay ?? null,
    monthNth: body.monthNth ?? null,
    monthNthWeekday: body.monthNthWeekday ?? null,
    startDate: body.startDate,
    endDate: body.endDate ?? null,
    remindAtTimeOfDay: body.remindAtTimeOfDay ?? null,
    updatedAt: now,
  };

  const [existing] = await db
    .select()
    .from(taskRecurrences)
    .where(eq(taskRecurrences.taskId, taskId))
    .limit(1);

  if (existing) {
    await db
      .update(taskRecurrences)
      .set(payload)
      .where(eq(taskRecurrences.taskId, taskId));
  } else {
    await db.insert(taskRecurrences).values({
      id: nanoid(),
      taskId,
      ...payload,
      createdAt: now,
    });
  }

  // Materialize today if rule covers today (一次性、ON CONFLICT DO NOTHING)
  const today = new Date().toISOString().slice(0, 10);
  const rule: RecurrenceRule = {
    preset: payload.preset,
    weekdays: payload.weekdays,
    monthDay: payload.monthDay,
    monthNth: payload.monthNth,
    monthNthWeekday: payload.monthNthWeekday,
    startDate: payload.startDate,
    endDate: payload.endDate,
  };
  if (occurs(today, rule)) {
    await db
      .insert(dailyTaskAssignments)
      .values({
        id: nanoid(),
        taskId,
        date: today,
        isCompleted: false,
        isSkipped: false,
        sortOrder: 0,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();
  }

  // Reconcile：編輯既有規則時，回收舊規則 materialize 出來、現在落在新窗外
  // 的未來 occurrence，否則它們會變孤兒（永遠卡 overdue，或日期=今天時誤
  // 出現在「今天」）。只在 existing 時做 — 首次建立沒有前一版規則的孤兒，
  // 且避免誤刪使用者手動排進未來的 occurrence。
  if (existing) {
    const taskAssignments = await db
      .select({
        date: dailyTaskAssignments.date,
        isCompleted: dailyTaskAssignments.isCompleted,
        isSkipped: dailyTaskAssignments.isSkipped,
      })
      .from(dailyTaskAssignments)
      .where(eq(dailyTaskAssignments.taskId, taskId));
    const reapDates = assignmentsToReap(taskAssignments, rule, today);
    if (reapDates.length > 0) {
      await db
        .delete(dailyTaskAssignments)
        .where(
          and(
            eq(dailyTaskAssignments.taskId, taskId),
            inArray(dailyTaskAssignments.date, reapDates),
          ),
        );
    }
  }

  const [saved] = await db
    .select()
    .from(taskRecurrences)
    .where(eq(taskRecurrences.taskId, taskId))
    .limit(1);
  // 重要：規則變動的 push 讓 iOS 在背景重排本地通知 —— 沒有這個，web/Mac
  // 改窄規則後 iOS 已排入的舊 occurrence 通知會照舊觸發（推播了但當天清單
  // 沒有任務的幽靈通知）。
  notifyUserDevices(user.id);
  return NextResponse.json(saved);
}

/**
 * DELETE /api/tasks/[id]/recurrence — 移除重複規則，task 本體保留為普通
 * 任務。並回收未來、未完成、未跳過的已 materialize occurrence（沒了規則
 * 它們全是孤兒，留著會卡 overdue / 誤現在今天）。過去 + 今天 + 已完成 +
 * 已跳過保留，當歷史紀錄。
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: taskId } = await params;
  if (!(await ownsTask(taskId, user.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(taskRecurrences).where(eq(taskRecurrences.taskId, taskId));

  const today = new Date().toISOString().slice(0, 10);
  const taskAssignments = await db
    .select({
      date: dailyTaskAssignments.date,
      isCompleted: dailyTaskAssignments.isCompleted,
      isSkipped: dailyTaskAssignments.isSkipped,
    })
    .from(dailyTaskAssignments)
    .where(eq(dailyTaskAssignments.taskId, taskId));
  const reapDates = assignmentsToReap(taskAssignments, null, today);
  if (reapDates.length > 0) {
    await db
      .delete(dailyTaskAssignments)
      .where(
        and(
          eq(dailyTaskAssignments.taskId, taskId),
          inArray(dailyTaskAssignments.date, reapDates),
        ),
      );
  }

  notifyUserDevices(user.id);
  return NextResponse.json({ success: true });
}

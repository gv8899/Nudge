// First-run onboarding 的寫入端：搶門閂（onboarded_at）→ 在單一 transaction
// 內把 SeedPlan 落庫。冪等、race-safe、失敗不 throw（不擋登入）。

import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  users,
  tags,
  tasks,
  taskTags,
  statusHistory,
  dailyTaskAssignments,
  taskRecurrences,
  dailyNotes,
  notificationPreferences,
} from "@/lib/db/schema";
import { contentForLocale } from "./content";
import { buildOnboardingSeed } from "./build-seed";

// 建帳號當下不知道使用者時區（locale/tz 都可能還沒設）。主要受眾為台灣 →
// 預設台北時區決定 seed 的「今天」。差一天仍合理（逾期就是逾期）。
const DEFAULT_SEED_TZ = "Asia/Taipei";

/**
 * 若 user 尚未 onboard，seed 範例任務/卡片並標記 onboarded_at。
 * @returns 是否真的執行了 seed（false = 已 onboard / 被別人搶先 / 失敗）。
 */
export async function maybeSeedOnboarding(
  userId: string,
  locale: string | null,
  tz: string = DEFAULT_SEED_TZ,
): Promise<boolean> {
  try {
    return await db.transaction(async (tx) => {
      // ① 條件式搶門閂 —— 只有 onboarded_at 仍為 NULL 的那一方拿得到。
      const nowISO = new Date().toISOString();
      const latched = await tx
        .update(users)
        .set({ onboardedAt: nowISO })
        .where(and(eq(users.id, userId), isNull(users.onboardedAt)))
        .returning({ id: users.id });

      if (latched.length === 0) return false; // 已 onboard 或別的裝置搶先

      // ② 解析內容 → 具體 rows。
      const plan = buildOnboardingSeed(contentForLocale(locale), new Date(), tz);

      // ③ 標籤（key → id）。
      const tagIdByKey = new Map<string, string>();
      for (const t of plan.tags) {
        const id = nanoid();
        tagIdByKey.set(t.key, id);
        await tx.insert(tags).values({
          id,
          userId,
          name: t.name,
          color: t.color,
          sortOrder: t.sortOrder,
        });
      }

      // ④ 任務 + 卡片（統一 task row）。
      let assignOrder = 0;
      for (const r of plan.tasks) {
        const taskId = nanoid();
        await tx.insert(tasks).values({
          id: taskId,
          userId,
          title: r.title,
          description: r.description,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.createdAt,
          completedAt: r.status === "done" ? r.createdAt : null,
          remindAt: r.remindAt,
          sortOrder: r.sortOrder,
        });
        await tx.insert(statusHistory).values({
          id: nanoid(),
          taskId,
          fromStatus: null,
          toStatus: r.status,
          changedAt: r.createdAt,
        });
        if (r.assignment) {
          await tx
            .insert(dailyTaskAssignments)
            .values({
              id: nanoid(),
              taskId,
              date: r.assignment.date,
              isCompleted: r.assignment.isCompleted,
              isSkipped: false,
              sortOrder: assignOrder++,
              updatedAt: nowISO,
            })
            .onConflictDoNothing({
              target: [dailyTaskAssignments.taskId, dailyTaskAssignments.date],
            });
        }
        if (r.recurrence) {
          await tx.insert(taskRecurrences).values({
            id: nanoid(),
            taskId,
            preset: r.recurrence.preset,
            weekdays: r.recurrence.weekdays,
            startDate: r.recurrence.startDate,
            remindAtTimeOfDay: r.recurrence.remindAtTimeOfDay,
            createdAt: r.createdAt,
            updatedAt: r.createdAt,
          });
        }
        if (r.tagKey) {
          const tagId = tagIdByKey.get(r.tagKey);
          if (tagId) await tx.insert(taskTags).values({ taskId, tagId });
        }
      }

      // ⑤ 日誌。
      for (const n of plan.notes) {
        await tx.insert(dailyNotes).values({
          id: nanoid(),
          userId,
          date: n.date,
          content: n.content,
          createdAt: nowISO,
          sortOrder: n.sortOrder,
        });
      }

      // ⑥ 開啟 per-task 提醒（每 user 一筆）。
      await tx
        .insert(notificationPreferences)
        .values({ userId, perTaskRemindersEnabled: true, updatedAt: nowISO })
        .onConflictDoUpdate({
          target: notificationPreferences.userId,
          set: { perTaskRemindersEnabled: true, updatedAt: nowISO },
        });

      return true;
    });
  } catch (e) {
    // 失敗一律吞掉：不擋登入、onboarded_at 隨 tx rollback 保持 NULL，可容後補救。
    console.error("maybeSeedOnboarding failed:", e);
    return false;
  }
}

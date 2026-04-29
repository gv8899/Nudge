-- daily_task_assignments 加 updated_at
-- 對應 schema 變更:
--   1. dailyTaskAssignments 加 updatedAt: text NOT NULL
--
-- 動機:
--   /api/daily/[date] 的 ETag 原本用 task.updatedAt，但勾/解勾 / 跳過 /
--   排序 / 移日只動 daily_task_assignments、不會 bump tasks.updatedAt，
--   導致 client 304 短路後 UI 不更新（symptom：「前幾天」勾掉沒消失，
--   切到別的日期再切回來才會、4/27 解勾後今天 overdue 沒重現）。
--   ETag 改用 max(assignment.updated_at)，由 PATCH endpoints 統一維護。

ALTER TABLE "daily_task_assignments"
  ADD COLUMN IF NOT EXISTS "updated_at" text;

-- Backfill 既有 row：用當下 UTC ISO8601 ms。新 ETag 在這個 column 出現後
-- 會立刻變動一次（因為 max 從 task.updatedAt 切到這欄），client 端被迫
-- refetch 一次 → 之後就靠單筆 PATCH bump 維持精準。
UPDATE "daily_task_assignments"
  SET "updated_at" = to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE "updated_at" IS NULL;

ALTER TABLE "daily_task_assignments"
  ALTER COLUMN "updated_at" SET NOT NULL;

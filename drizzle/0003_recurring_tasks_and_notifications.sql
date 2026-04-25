-- 重複任務 + 智慧通知
-- 對應 schema 變更:
--   1. dailyTaskAssignments 加 isSkipped + UNIQUE (taskId, date)
--   2. 新表 task_recurrences (1:1 task)
--   3. 新表 notification_preferences (1:1 user)

ALTER TABLE "daily_task_assignments"
  ADD COLUMN "is_skipped" boolean DEFAULT false NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "daily_task_assignments_task_date_uniq"
  ON "daily_task_assignments" ("task_id", "date");

CREATE TABLE IF NOT EXISTS "task_recurrences" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL UNIQUE
    REFERENCES "tasks"("id") ON DELETE CASCADE,
  "preset" text NOT NULL,
  "weekdays" text,
  "month_day" integer,
  "month_nth" integer,
  "month_nth_weekday" integer,
  "start_date" text NOT NULL,
  "end_date" text,
  "remind_at_time_of_day" text,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "user_id" text PRIMARY KEY NOT NULL
    REFERENCES "users"("id") ON DELETE CASCADE,
  "morning_enabled" boolean DEFAULT true NOT NULL,
  "morning_time" text DEFAULT '09:00' NOT NULL,
  "morning_content" text DEFAULT 'summary' NOT NULL,
  "evening_enabled" boolean DEFAULT true NOT NULL,
  "evening_time" text DEFAULT '21:00' NOT NULL,
  "evening_content" text DEFAULT 'incomplete' NOT NULL,
  "per_task_reminders_enabled" boolean DEFAULT true NOT NULL,
  "updated_at" text NOT NULL
);

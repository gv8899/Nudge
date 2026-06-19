import { pgTable, text, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  locale: text("locale"),
  // Sign in with Apple：穩定的 Apple user id（sub）。Apple 只在首次授權回
  // email/名字，之後只給 sub → 用這欄當穩定鍵，不能只靠 email。
  appleSub: text("apple_sub").unique(),
  createdAt: text("created_at").notNull(),
  // Google Calendar integration
  googleCalendarAccessToken: text("google_calendar_access_token"),
  googleCalendarRefreshToken: text("google_calendar_refresh_token"),
  googleCalendarTokenExpires: text("google_calendar_token_expires"),
  googleCalendarSelectedIds: text("google_calendar_selected_ids"),
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["inbox", "backlog", "in_progress", "waiting", "done", "archived"],
  })
    .notNull()
    .default("inbox"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
  remindAt: text("remind_at"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("chart-1"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const taskTags = pgTable("task_tags", {
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  tagId: text("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
});

export const statusHistory = pgTable("status_history", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedAt: text("changed_at").notNull(),
  note: text("note"),
});

export const dailyTaskAssignments = pgTable(
  "daily_task_assignments",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    isCompleted: boolean("is_completed").notNull().default(false),
    isSkipped: boolean("is_skipped").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    // Bump on every PATCH (isCompleted / isSkipped / sortOrder / move). 給
    // /api/daily/[date] 的 ETag 用，保證跨日勾/解勾都會讓 ETag 變動。
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    uniqTaskDate: uniqueIndex("daily_task_assignments_task_date_uniq").on(
      table.taskId,
      table.date,
    ),
  }),
);

export const dailyNotes = pgTable("daily_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// 重複任務規則 — 每個 task 最多一條 (UNIQUE on taskId)。preset 系統 + 額外
// 欄位來描述變化（weekdays CSV、monthDay 等）。未來要升級到完整 RRULE
// 只需多一個 rruleOverride 欄位。
export const taskRecurrences = pgTable("task_recurrences", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .unique()
    .references(() => tasks.id, { onDelete: "cascade" }),
  preset: text("preset", {
    enum: [
      "daily",
      "weekdays",
      "weekly",
      "biweekly",
      "monthly_day",
      "monthly_nth_weekday",
      "yearly",
    ],
  }).notNull(),
  weekdays: text("weekdays"), // CSV "1,3,5" — ISO weekday 1=Mon..7=Sun
  monthDay: integer("month_day"), // 1..31
  monthNth: integer("month_nth"), // 1..5 (5 = last)
  monthNthWeekday: integer("month_nth_weekday"), // 1..7
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date"), // YYYY-MM-DD or null (no end)
  remindAtTimeOfDay: text("remind_at_time_of_day"), // HH:MM or null
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// 通知偏好 — 每 user 一筆。早晚批次摘要的開關 / 時段 / 內容、外加 per-task
// reminder 全局開關。
export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  morningEnabled: boolean("morning_enabled").notNull().default(true),
  morningTime: text("morning_time").notNull().default("09:00"), // HH:MM
  morningContent: text("morning_content", {
    enum: ["summary", "incomplete", "summary_streak"],
  })
    .notNull()
    .default("summary"),
  eveningEnabled: boolean("evening_enabled").notNull().default(true),
  eveningTime: text("evening_time").notNull().default("21:00"),
  eveningContent: text("evening_content", {
    enum: ["summary", "incomplete", "summary_streak"],
  })
    .notNull()
    .default("incomplete"),
  perTaskRemindersEnabled: boolean("per_task_reminders_enabled")
    .notNull()
    .default(true),
  updatedAt: text("updated_at").notNull(),
});

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
  // 試用一生一次：首次發 trial 時寫入（綁帳號）。NULL = 從沒試用過。
  // 帳號刪除重建仍以 apple_sub/email 識別，避免重複領免費試用。
  trialStartedAt: text("trial_started_at"),
  // First-run onboarding 門閂（ISO string）。NULL = 尚未 onboard（新帳號建立
  // 時 seed 範例任務/卡片後寫入時間戳）。既有帳號在 migration 一次性設為 now()
  // → 視為已 onboard，永不 seed。條件式 UPDATE ... WHERE onboarded_at IS NULL
  // 保證只 seed 一次（跨裝置首登 race-safe）。
  onboardedAt: text("onboarded_at"),
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

// ── APNs 裝置 token（即時同步 silent push）─────────────────────────────────
// 一台裝置一列，token 全域唯一（同裝置換帳號登入 → upsert 改 userId 歸屬）。
// environment：DEBUG build 走 APNs sandbox、release 走 production —— 由 app
// 註冊時自報，後端發推播時選對應的 APNs host。
// last_pushed_at：per-device 節流戳（同 user 5 秒內多次變動只推一次），用
// DB 原子 claim 避免 serverless 多實例重複推。
export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform", { enum: ["ios", "macos"] }).notNull(),
    environment: text("environment", { enum: ["sandbox", "production"] })
      .notNull()
      .default("production"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastPushedAt: text("last_pushed_at"),
  },
  (table) => ({
    uniqToken: uniqueIndex("device_tokens_token_uniq").on(table.token),
  }),
);

// ── 付費 entitlement（Phase 1，演進自 Slice A）──────────────────────────────
// provider-neutral：所有授權來源（trial/comp/promo/manual/paddle/apple/newebpay）
// 都經單一寫入點（grantAccess）upsert 進這張表。一 user 一列、all-or-nothing。
//
// 相容備忘：`access_until` 是 Slice A 舊欄位，**保留並與 `current_period_end`
// 雙寫**（dev/prod 共用 DB、舊 code 可能仍在跑時的安全網）。新邏輯一律讀
// `current_period_end`，舊欄位只做 fallback / 鏡像，未來確認無舊 code 後再 drop。
export const subscriptions = pgTable("subscriptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // 授權狀態（真相）。trialing/active = 有權；其餘無權。
  status: text("status", {
    enum: ["trialing", "active", "past_due", "canceled", "expired"],
  })
    .notNull()
    .default("trialing"),
  // 方案（金流來源才有）。NULL = 試用 / 手動 / promo。
  plan: text("plan", { enum: ["monthly", "annual"] }),
  // 授權來源。trial/comp 為 Slice A 舊值（保留相容）；新寫入用
  // apple/paddle/manual/promo/newebpay。
  source: text("source", {
    enum: ["trial", "comp", "promo", "manual", "paddle", "apple", "newebpay"],
  }).notNull(),
  // 本期 / 授權到期（ISO string）；NULL = 永久（admin 永久授權）。
  currentPeriodEnd: text("current_period_end"),
  // 試用到期（ISO string）；僅 trialing 期間有意義。
  trialEnd: text("trial_end"),
  // 外部金流識別（RevenueCat / Paddle 等）。
  externalCustomerId: text("external_customer_id"),
  externalSubscriptionId: text("external_subscription_id"),
  // 已排定期末取消（仍有權至 currentPeriodEnd）。
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  // 【deprecated】Slice A 舊欄位，與 current_period_end 雙寫；勿在新邏輯讀取。
  accessUntil: text("access_until"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at").notNull(),
});

// 兌換碼。唯一單次碼 = maxRedemptions:1；共用多人碼 = maxRedemptions:N/null。
export const promoCodes = pgTable("promo_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  grantDays: integer("grant_days").notNull(),
  maxRedemptions: integer("max_redemptions"), // NULL = 無限
  perUserLimit: integer("per_user_limit").notNull().default(1),
  redeemedCount: integer("redeemed_count").notNull().default(0),
  expiresAt: text("expires_at"), // NULL = 碼不過期
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull(),
});

// Paddle webhook 冪等去重 — 一 event 一列（event_id 為 Paddle 全域唯一）。
// insert onConflictDoNothing 失敗 = 已處理過 → skip。occurred_at 供亂序判斷
// （舊事件不覆蓋新狀態）。
export const webhookEvents = pgTable("webhook_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  occurredAt: text("occurred_at").notNull(),
  processedAt: text("processed_at").notNull(),
});

// 兌換紀錄 — 擋重複 + 計次（per-user limit / 總次數）。
export const promoRedemptions = pgTable("promo_redemptions", {
  id: text("id").primaryKey(),
  codeId: text("code_id")
    .notNull()
    .references(() => promoCodes.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  redeemedAt: text("redeemed_at").notNull(),
});

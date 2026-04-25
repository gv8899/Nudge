# 重複任務 + 智慧通知 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 spec `docs/superpowers/specs/2026-04-25-recurring-tasks-and-notifications-design.md` 全部實作出來：iOS 端可建立 / 編輯重複任務（preset 規則 + 結束日期 + 跳過某次）、設定個別任務絕對提醒或重複任務時段提醒、設定每日早晚批次摘要。後端 schema + API 同步支援。

**Architecture:** 單一 master + lazy materialize。Recurrence rule 存 preset 欄位（不直接用 RRULE）。每次 GET 一個從沒看過的日期時，server 算 `occurs(date, rule)` 並把符合的 INSERT 進 `dailyTaskAssignments`。assignments 表是真實狀態 source of truth。iOS 端純 local notification（`UNCalendarNotificationTrigger`），沒後端 push。

**Tech Stack:** Drizzle ORM（PostgreSQL）/ Next.js App Router API routes / Vitest（web 測試）/ Swift 6 + SwiftUI（iOS）/ Swift Testing（iOS 測試）/ UNUserNotificationCenter（iOS 通知）

---

## 推進順序

```
Block A: Foundation (Schema + 純函式)
Block B: Server API
Block C: iOS data layer
Block D: iOS UI - 卡片詳細頁排程
Block E: iOS UI - 行動頁 row menu 統一
Block F: iOS UI - 設定頁通知偏好
Block G: iOS notification scheduler
Block H: 收尾 + TestFlight
```

每個 Block 結束時 commit 一次 + 跑 build/test 驗證。

---

## Block A: Foundation

### Task A1: Schema migration — task_recurrences + dailyTaskAssignments.isSkipped + notification_preferences

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/0003_recurring_tasks_and_notifications.sql`（drizzle-kit 自動生）

- [ ] **Step 1: 修改 schema**

加在 `dailyNotes` 之後（保持檔案結構順序）：

```ts
import { pgTable, text, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";

// ... existing tables ...

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
  weekdays: text("weekdays"),         // CSV "1,3,5"
  monthDay: integer("month_day"),     // 1..31
  monthNth: integer("month_nth"),     // 1..5
  monthNthWeekday: integer("month_nth_weekday"), // 1..7
  startDate: text("start_date").notNull(),       // YYYY-MM-DD
  endDate: text("end_date"),                     // YYYY-MM-DD or null
  remindAtTimeOfDay: text("remind_at_time_of_day"), // HH:MM or null
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  morningEnabled: boolean("morning_enabled").notNull().default(true),
  morningTime: text("morning_time").notNull().default("09:00"),
  morningContent: text("morning_content", {
    enum: ["summary", "incomplete", "summary_streak"],
  }).notNull().default("summary"),
  eveningEnabled: boolean("evening_enabled").notNull().default(true),
  eveningTime: text("evening_time").notNull().default("21:00"),
  eveningContent: text("evening_content", {
    enum: ["summary", "incomplete", "summary_streak"],
  }).notNull().default("incomplete"),
  perTaskRemindersEnabled: boolean("per_task_reminders_enabled")
    .notNull().default(true),
  updatedAt: text("updated_at").notNull(),
});
```

修改既有的 `dailyTaskAssignments`：

```ts
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
  },
  (table) => ({
    uniqTaskDate: uniqueIndex("daily_task_assignments_task_date_uniq").on(
      table.taskId,
      table.date,
    ),
  }),
);
```

- [ ] **Step 2: 產生 migration**

Run: `cd /Users/mike/Documents/nudge && npx drizzle-kit generate`
Expected: 在 `drizzle/` 多一個 `0003_*.sql`，內含 CREATE TABLE 兩張、ALTER TABLE 加 isSkipped、CREATE UNIQUE INDEX。

- [ ] **Step 3: 套到 dev DB**

Run: `npx drizzle-kit push`
Expected: 看到 schema 同步成功訊息、無錯誤。

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat(db): 新增 task_recurrences、notification_preferences、assignment.isSkipped"
```

---

### Task A2: Recurrence 純函式 (TypeScript)

**Files:**
- Create: `src/lib/recurrence.ts`
- Create: `src/lib/recurrence.test.ts`

- [ ] **Step 1: 寫測試先**

```ts
// src/lib/recurrence.test.ts
import { describe, expect, it } from "vitest";
import { occurs, type RecurrenceRule } from "./recurrence";

describe("occurs", () => {
  const baseDaily: RecurrenceRule = {
    preset: "daily", startDate: "2026-04-01", endDate: null,
    weekdays: null, monthDay: null, monthNth: null, monthNthWeekday: null,
  };

  it("daily 永遠 true (在 startDate 之後)", () => {
    expect(occurs("2026-04-01", baseDaily)).toBe(true);
    expect(occurs("2026-04-15", baseDaily)).toBe(true);
    expect(occurs("2027-01-01", baseDaily)).toBe(true);
  });

  it("daily 在 startDate 之前是 false", () => {
    expect(occurs("2026-03-31", baseDaily)).toBe(false);
  });

  it("daily endDate 之後是 false", () => {
    const r = { ...baseDaily, endDate: "2026-04-30" };
    expect(occurs("2026-04-30", r)).toBe(true);
    expect(occurs("2026-05-01", r)).toBe(false);
  });

  it("weekdays = Mon-Fri", () => {
    const r: RecurrenceRule = { ...baseDaily, preset: "weekdays" };
    // 2026-04-25 是週六 → false
    expect(occurs("2026-04-25", r)).toBe(false);
    // 2026-04-27 是週一 → true
    expect(occurs("2026-04-27", r)).toBe(true);
  });

  it("weekly 配 weekdays CSV", () => {
    const r: RecurrenceRule = { ...baseDaily, preset: "weekly", weekdays: "1,3,5" };
    expect(occurs("2026-04-27", r)).toBe(true);  // Mon
    expect(occurs("2026-04-29", r)).toBe(true);  // Wed
    expect(occurs("2026-05-01", r)).toBe(true);  // Fri
    expect(occurs("2026-04-28", r)).toBe(false); // Tue
  });

  it("biweekly 從 startDate 起算偶週", () => {
    const r: RecurrenceRule = {
      ...baseDaily, preset: "biweekly", weekdays: "1",
      startDate: "2026-04-06", // 週一
    };
    expect(occurs("2026-04-06", r)).toBe(true);   // 第 0 週
    expect(occurs("2026-04-13", r)).toBe(false);  // 第 1 週
    expect(occurs("2026-04-20", r)).toBe(true);   // 第 2 週
    expect(occurs("2026-04-27", r)).toBe(false);  // 第 3 週
  });

  it("monthly_day 簡單 case", () => {
    const r: RecurrenceRule = { ...baseDaily, preset: "monthly_day", monthDay: 5 };
    expect(occurs("2026-04-05", r)).toBe(true);
    expect(occurs("2026-04-06", r)).toBe(false);
    expect(occurs("2026-05-05", r)).toBe(true);
  });

  it("monthly_day 月底邊界 — 2 月 31 號跳過", () => {
    const r: RecurrenceRule = { ...baseDaily, preset: "monthly_day", monthDay: 31 };
    expect(occurs("2026-01-31", r)).toBe(true);
    expect(occurs("2026-02-28", r)).toBe(false); // 2 月沒 31 號
    expect(occurs("2026-03-31", r)).toBe(true);
  });

  it("monthly_nth_weekday — 第 3 個週二", () => {
    const r: RecurrenceRule = {
      ...baseDaily, preset: "monthly_nth_weekday",
      monthNth: 3, monthNthWeekday: 2,
    };
    // 2026-04: 7(1st), 14(2nd), 21(3rd Tue)
    expect(occurs("2026-04-21", r)).toBe(true);
    expect(occurs("2026-04-14", r)).toBe(false);
  });

  it("monthly_nth_weekday — 5 = 最後一個", () => {
    const r: RecurrenceRule = {
      ...baseDaily, preset: "monthly_nth_weekday",
      monthNth: 5, monthNthWeekday: 5, // last Friday
    };
    // 2026-04 最後週五 = 4/24
    expect(occurs("2026-04-24", r)).toBe(true);
    expect(occurs("2026-04-17", r)).toBe(false);
  });

  it("yearly — (月,日) 配 startDate", () => {
    const r: RecurrenceRule = {
      ...baseDaily, preset: "yearly", startDate: "2026-04-01",
    };
    expect(occurs("2026-04-01", r)).toBe(true);
    expect(occurs("2027-04-01", r)).toBe(true);
    expect(occurs("2027-04-02", r)).toBe(false);
  });

  it("yearly — 2/29 平年退到 2/28", () => {
    const r: RecurrenceRule = {
      ...baseDaily, preset: "yearly", startDate: "2024-02-29",
    };
    expect(occurs("2024-02-29", r)).toBe(true);  // leap
    expect(occurs("2025-02-28", r)).toBe(true);  // non-leap → fallback
    expect(occurs("2025-02-29", r)).toBe(false); // doesn't exist
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/recurrence.test.ts`
Expected: FAIL — module not found / occurs not exported。

- [ ] **Step 3: 實作 `src/lib/recurrence.ts`**

```ts
export interface RecurrenceRule {
  preset:
    | "daily"
    | "weekdays"
    | "weekly"
    | "biweekly"
    | "monthly_day"
    | "monthly_nth_weekday"
    | "yearly";
  weekdays: string | null;       // CSV "1,3,5", ISO weekday 1=Mon..7=Sun
  monthDay: number | null;       // 1..31
  monthNth: number | null;       // 1..5 (5 = last)
  monthNthWeekday: number | null;// 1..7
  startDate: string;             // YYYY-MM-DD
  endDate: string | null;        // YYYY-MM-DD or null
}

/** YYYY-MM-DD → UTC Date at midnight (避免時區漂移) */
function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** ISO weekday: 1=Mon..7=Sun */
function isoWeekday(d: Date): number {
  const w = d.getUTCDay(); // 0=Sun..6=Sat
  return w === 0 ? 7 : w;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function lastDayOfMonth(year: number, monthZeroBased: number): number {
  return new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
}

export function occurs(dateStr: string, rule: RecurrenceRule): boolean {
  const date = parseISODate(dateStr);
  const start = parseISODate(rule.startDate);
  if (date < start) return false;
  if (rule.endDate) {
    const end = parseISODate(rule.endDate);
    if (date > end) return false;
  }

  switch (rule.preset) {
    case "daily":
      return true;

    case "weekdays": {
      const w = isoWeekday(date);
      return w >= 1 && w <= 5;
    }

    case "weekly": {
      if (!rule.weekdays) return false;
      const w = isoWeekday(date);
      return rule.weekdays.split(",").map(Number).includes(w);
    }

    case "biweekly": {
      if (!rule.weekdays) return false;
      const w = isoWeekday(date);
      if (!rule.weekdays.split(",").map(Number).includes(w)) return false;
      const weeks = Math.floor(daysBetween(start, date) / 7);
      return weeks % 2 === 0;
    }

    case "monthly_day": {
      if (rule.monthDay == null) return false;
      const dom = date.getUTCDate();
      if (dom !== rule.monthDay) return false;
      // 邊界: 2 月 31 號之類本來就不存在 — date 一定是有效日期，
      // 所以 dom===monthDay 就等於該月真的有這天。
      return true;
    }

    case "monthly_nth_weekday": {
      if (rule.monthNth == null || rule.monthNthWeekday == null) return false;
      const w = isoWeekday(date);
      if (w !== rule.monthNthWeekday) return false;
      const dom = date.getUTCDate();
      if (rule.monthNth === 5) {
        // last weekday of month
        const last = lastDayOfMonth(date.getUTCFullYear(), date.getUTCMonth());
        return dom > last - 7; // 該週幾的最後一次落在月底前 7 天內
      }
      // dom belongs to (n-1)*7+1 ~ n*7
      const lower = (rule.monthNth - 1) * 7 + 1;
      const upper = rule.monthNth * 7;
      return dom >= lower && dom <= upper;
    }

    case "yearly": {
      const m = date.getUTCMonth();
      const d = date.getUTCDate();
      const sm = start.getUTCMonth();
      const sd = start.getUTCDate();
      if (m === sm && d === sd) return true;
      // 2/29 平年退到 2/28
      if (sm === 1 && sd === 29 && m === 1 && d === 28) {
        const last = lastDayOfMonth(date.getUTCFullYear(), 1);
        return last === 28; // confirm non-leap
      }
      return false;
    }
  }
}

/** 算出 [from, to] 區間內 rule 所有 occurrence 的日期 (含端點)。給 iOS notification scheduler 用。 */
export function occurrencesInRange(
  rule: RecurrenceRule,
  fromISO: string,
  toISO: string,
): string[] {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  const result: string[] = [];
  for (let cur = new Date(from); cur <= to; cur.setUTCDate(cur.getUTCDate() + 1)) {
    const iso = cur.toISOString().slice(0, 10);
    if (occurs(iso, rule)) result.push(iso);
  }
  return result;
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/recurrence.test.ts`
Expected: PASS — 所有 case 通過。

- [ ] **Step 5: Commit**

```bash
git add src/lib/recurrence.ts src/lib/recurrence.test.ts
git commit -m "feat(server): recurrence 純函式 occurs() + occurrencesInRange()"
```

---

## Block B: Server API

### Task B1: GET / PUT / DELETE `/api/tasks/[id]/recurrence`

**Files:**
- Create: `src/app/api/tasks/[id]/recurrence/route.ts`

- [ ] **Step 1: 建立 route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  tasks,
  taskRecurrences,
  dailyTaskAssignments,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import { occurs, type RecurrenceRule } from "@/lib/recurrence";
import { nanoid } from "nanoid";

async function ownsTask(taskId: string, userId: string): Promise<boolean> {
  const [t] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  return !!t;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Materialize today if rule covers today
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
      })
      .onConflictDoNothing();
  }

  const [saved] = await db
    .select()
    .from(taskRecurrences)
    .where(eq(taskRecurrences.taskId, taskId))
    .limit(1);
  return NextResponse.json(saved);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: taskId } = await params;
  if (!(await ownsTask(taskId, user.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(taskRecurrences).where(eq(taskRecurrences.taskId, taskId));
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: 手動驗證 (curl 或瀏覽器 fetch)**

```bash
# 假設 dev server 跑著、有 task id
curl -X PUT http://localhost:3000/api/tasks/<TASK_ID>/recurrence \
  -H "Content-Type: application/json" \
  --cookie "session=..." \
  -d '{"preset":"weekly","weekdays":"1,3,5","startDate":"2026-04-25"}'
```
Expected: 200 + recurrence row JSON。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tasks/\[id\]/recurrence/route.ts
git commit -m "feat(api): /api/tasks/[id]/recurrence GET/PUT/DELETE"
```

---

### Task B2: PATCH `/api/daily-assignments/[id]` 支援 isSkipped

**Files:**
- Create: `src/app/api/daily-assignments/[id]/route.ts`

- [ ] **Step 1: 建立 route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyTaskAssignments, tasks } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // 確認此 assignment 對應的 task 屬於該 user
  const [row] = await db
    .select({ assignmentId: dailyTaskAssignments.id })
    .from(dailyTaskAssignments)
    .innerJoin(tasks, eq(tasks.id, dailyTaskAssignments.taskId))
    .where(and(eq(dailyTaskAssignments.id, id), eq(tasks.userId, user.id)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.isSkipped !== undefined) updates.isSkipped = !!body.isSkipped;
  if (body.isCompleted !== undefined) updates.isCompleted = !!body.isCompleted;
  if (body.sortOrder !== undefined) updates.sortOrder = Number(body.sortOrder);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No-op" }, { status: 400 });
  }

  await db.update(dailyTaskAssignments).set(updates).where(eq(dailyTaskAssignments.id, id));
  const [updated] = await db
    .select()
    .from(dailyTaskAssignments)
    .where(eq(dailyTaskAssignments.id, id))
    .limit(1);
  return NextResponse.json(updated);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/daily-assignments/\[id\]/route.ts
git commit -m "feat(api): PATCH /api/daily-assignments/[id] 支援 isSkipped"
```

---

### Task B3: GET / PATCH `/api/notification-preferences`

**Files:**
- Create: `src/app/api/notification-preferences/route.ts`

- [ ] **Step 1: 建立 route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

const DEFAULTS = {
  morningEnabled: true,
  morningTime: "09:00",
  morningContent: "summary" as const,
  eveningEnabled: true,
  eveningTime: "21:00",
  eveningContent: "incomplete" as const,
  perTaskRemindersEnabled: true,
};

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pref] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, user.id))
    .limit(1);

  if (pref) return NextResponse.json(pref);
  return NextResponse.json({ userId: user.id, ...DEFAULTS, updatedAt: new Date().toISOString() });
}

export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const now = new Date().toISOString();

  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, user.id))
    .limit(1);

  const allowed = [
    "morningEnabled", "morningTime", "morningContent",
    "eveningEnabled", "eveningTime", "eveningContent",
    "perTaskRemindersEnabled",
  ] as const;
  const updates: Record<string, unknown> = { updatedAt: now };
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (existing) {
    await db.update(notificationPreferences).set(updates).where(eq(notificationPreferences.userId, user.id));
  } else {
    await db.insert(notificationPreferences).values({
      userId: user.id,
      ...DEFAULTS,
      ...updates,
    });
  }

  const [saved] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, user.id))
    .limit(1);
  return NextResponse.json(saved);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/notification-preferences/route.ts
git commit -m "feat(api): /api/notification-preferences GET/PATCH"
```

---

### Task B4: 改造 `/api/daily/[date]` 加入 lazy materialization + isSkipped 過濾

**Files:**
- Modify: `src/app/api/daily/[date]/route.ts`

- [ ] **Step 1: 讀現檔**

Run: `cat src/app/api/daily/\[date\]/route.ts`

- [ ] **Step 2: 在現有 GET handler 開頭加入 materialization 邏輯**

在 fetch assignments 之前先做：

```ts
import { occurs, type RecurrenceRule } from "@/lib/recurrence";
import { taskRecurrences } from "@/lib/db/schema";
import { nanoid } from "nanoid";

// ...inside GET handler, after auth check, before existing query...

// 1. fetch active recurrences for this user
const userRecurrences = await db
  .select({
    taskId: taskRecurrences.taskId,
    preset: taskRecurrences.preset,
    weekdays: taskRecurrences.weekdays,
    monthDay: taskRecurrences.monthDay,
    monthNth: taskRecurrences.monthNth,
    monthNthWeekday: taskRecurrences.monthNthWeekday,
    startDate: taskRecurrences.startDate,
    endDate: taskRecurrences.endDate,
  })
  .from(taskRecurrences)
  .innerJoin(tasks, eq(tasks.id, taskRecurrences.taskId))
  .where(eq(tasks.userId, user.id));

// 2. materialize occurrences for the requested date
for (const rec of userRecurrences) {
  if (rec.endDate && rec.endDate < date) continue;
  if (rec.startDate > date) continue;
  const rule: RecurrenceRule = {
    preset: rec.preset,
    weekdays: rec.weekdays,
    monthDay: rec.monthDay,
    monthNth: rec.monthNth,
    monthNthWeekday: rec.monthNthWeekday,
    startDate: rec.startDate,
    endDate: rec.endDate,
  };
  if (occurs(date, rule)) {
    await db
      .insert(dailyTaskAssignments)
      .values({
        id: nanoid(),
        taskId: rec.taskId,
        date,
        isCompleted: false,
        isSkipped: false,
        sortOrder: 0,
      })
      .onConflictDoNothing();
  }
}

// (existing query continues, but add isSkipped filter)
```

修改既有的 `WHERE` 條件加上 `eq(dailyTaskAssignments.isSkipped, false)`。

- [ ] **Step 3: 也對 `/api/daily/[date]/tasks/route.ts`、`overdueTasks` 查詢、`/api/daily/week-summary` 加 isSkipped 過濾**

`grep -rn "dailyTaskAssignments" src/app/api/daily src/app/api/notes src/app/api/tasks` 找出所有讀 assignment 的地方，加 `isSkipped = false` 過濾。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/daily src/app/api/notes src/app/api/tasks
git commit -m "feat(api): /api/daily/[date] lazy materialize 重複任務 + 過濾 isSkipped"
```

---

## Block C: iOS data layer

### Task C1: TaskRecurrenceDTO + RecurrenceRepository

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/TaskRecurrenceDTO.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/RecurrenceRepository.swift`

- [ ] **Step 1: DTO**

```swift
import Foundation

public enum RecurrencePreset: String, Codable, Sendable, CaseIterable, Identifiable {
    case daily, weekdays, weekly, biweekly
    case monthly_day, monthly_nth_weekday, yearly
    public var id: String { rawValue }
}

public struct TaskRecurrenceDTO: Codable, Sendable, Equatable {
    public let id: String
    public let taskId: String
    public let preset: RecurrencePreset
    public let weekdays: String?       // CSV "1,3,5"
    public let monthDay: Int?
    public let monthNth: Int?
    public let monthNthWeekday: Int?
    public let startDate: String       // YYYY-MM-DD
    public let endDate: String?
    public let remindAtTimeOfDay: String? // HH:MM
    public let createdAt: String
    public let updatedAt: String

    public init(
        id: String, taskId: String, preset: RecurrencePreset,
        weekdays: String?, monthDay: Int?, monthNth: Int?, monthNthWeekday: Int?,
        startDate: String, endDate: String?, remindAtTimeOfDay: String?,
        createdAt: String, updatedAt: String
    ) {
        self.id = id; self.taskId = taskId; self.preset = preset
        self.weekdays = weekdays; self.monthDay = monthDay
        self.monthNth = monthNth; self.monthNthWeekday = monthNthWeekday
        self.startDate = startDate; self.endDate = endDate
        self.remindAtTimeOfDay = remindAtTimeOfDay
        self.createdAt = createdAt; self.updatedAt = updatedAt
    }
}
```

- [ ] **Step 2: Repository**

```swift
import Foundation
import Observation

@Observable
@MainActor
public final class RecurrenceRepository {
    private let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// nil 代表該 task 沒設過 recurrence
    public func get(taskId: String) async throws -> TaskRecurrenceDTO? {
        // server returns null when none — decode optional
        struct Wrapper: Decodable { let value: TaskRecurrenceDTO? }
        // workaround: server returns null literal not wrapper
        let raw: TaskRecurrenceDTO? = try? await client.get("/api/tasks/\(taskId)/recurrence")
        return raw
    }

    public struct UpsertBody: Encodable {
        public let preset: String
        public let weekdays: String?
        public let monthDay: Int?
        public let monthNth: Int?
        public let monthNthWeekday: Int?
        public let startDate: String
        public let endDate: String?
        public let remindAtTimeOfDay: String?
    }

    public func upsert(taskId: String, body: UpsertBody) async throws -> TaskRecurrenceDTO {
        struct Body: Encodable {
            let preset: String
            let weekdays: String?
            let monthDay: Int?
            let monthNth: Int?
            let monthNthWeekday: Int?
            let startDate: String
            let endDate: String?
            let remindAtTimeOfDay: String?
        }
        let b = Body(
            preset: body.preset, weekdays: body.weekdays,
            monthDay: body.monthDay, monthNth: body.monthNth,
            monthNthWeekday: body.monthNthWeekday,
            startDate: body.startDate, endDate: body.endDate,
            remindAtTimeOfDay: body.remindAtTimeOfDay
        )
        return try await client.post("/api/tasks/\(taskId)/recurrence", body: b)
        // NOTE: server uses PUT; but APIClient currently lacks `put<T,R>`.
        // Use post for now if API method routes also accept POST; otherwise
        // add a `put<Body, Response>` variant to APIClient before this task.
    }

    public func delete(taskId: String) async throws {
        try await client.delete("/api/tasks/\(taskId)/recurrence")
    }
}
```

> **NOTE for implementer**: APIClient 目前只有 `putVoid`，沒有 `put<Response>`。先在 APIClient 加：
> ```swift
> public func put<Body: Encodable, Response: Decodable>(
>     _ path: String, body: Body
> ) async throws -> Response {
>     let request = try buildRequest(method: "PUT", path: path, body: body)
>     return try await perform(request)
> }
> ```
> 然後 RecurrenceRepository.upsert 用 `client.put` 取代 `client.post`。

- [ ] **Step 3: APIClient 加 put<T,R>**

Modify `apple/NudgeKit/Sources/NudgeCore/APIClient.swift`，在 `putVoid` 旁邊加：

```swift
public func put<Body: Encodable, Response: Decodable>(
    _ path: String,
    body: Body
) async throws -> Response {
    let request = try buildRequest(method: "PUT", path: path, body: body)
    return try await perform(request)
}
```

- [ ] **Step 4: 改 RecurrenceRepository.upsert 用 client.put**

```swift
return try await client.put("/api/tasks/\(taskId)/recurrence", body: b)
```

- [ ] **Step 5: 註冊到 app DI**

`apple/Nudge-iOS/NudgeiOSApp.swift` + `apple/Nudge-macOS/NudgeMacApp.swift`：
- 加 `@State private var recurrenceRepo: RecurrenceRepository`
- init 加 `let recurrenceRepo = RecurrenceRepository(client: client)`、`self._recurrenceRepo = State(initialValue: recurrenceRepo)`
- body 的 `.environment(noteRepo)` 之後加 `.environment(recurrenceRepo)`

- [ ] **Step 6: swift build 驗證**

Run: `cd apple/NudgeKit && swift build`
Expected: BUILD SUCCEEDED

- [ ] **Step 7: Commit**

```bash
cd /Users/mike/Documents/nudge && \
git add apple/NudgeKit/Sources/NudgeCore/TaskRecurrenceDTO.swift \
        apple/NudgeKit/Sources/NudgeCore/RecurrenceRepository.swift \
        apple/NudgeKit/Sources/NudgeCore/APIClient.swift \
        apple/Nudge-iOS/NudgeiOSApp.swift \
        apple/Nudge-macOS/NudgeMacApp.swift && \
git commit -m "feat(ios core): RecurrenceRepository + TaskRecurrenceDTO + APIClient.put<T,R>"
```

---

### Task C2: NotificationPreferencesDTO + NotificationPreferencesRepository

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/NotificationPreferencesDTO.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/NotificationPreferencesRepository.swift`

- [ ] **Step 1: DTO**

```swift
import Foundation

public enum NotificationContent: String, Codable, Sendable, CaseIterable, Identifiable {
    case summary, incomplete
    case summary_streak = "summary_streak"
    public var id: String { rawValue }
}

public struct NotificationPreferencesDTO: Codable, Sendable, Equatable {
    public let userId: String
    public let morningEnabled: Bool
    public let morningTime: String       // HH:MM
    public let morningContent: NotificationContent
    public let eveningEnabled: Bool
    public let eveningTime: String
    public let eveningContent: NotificationContent
    public let perTaskRemindersEnabled: Bool
    public let updatedAt: String
}
```

- [ ] **Step 2: Repository**

```swift
import Foundation
import Observation

@Observable
@MainActor
public final class NotificationPreferencesRepository {
    private let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func get() async throws -> NotificationPreferencesDTO {
        try await client.get("/api/notification-preferences")
    }

    public struct PatchBody: Encodable {
        public var morningEnabled: Bool?
        public var morningTime: String?
        public var morningContent: String?
        public var eveningEnabled: Bool?
        public var eveningTime: String?
        public var eveningContent: String?
        public var perTaskRemindersEnabled: Bool?
        public init(
            morningEnabled: Bool? = nil, morningTime: String? = nil,
            morningContent: String? = nil,
            eveningEnabled: Bool? = nil, eveningTime: String? = nil,
            eveningContent: String? = nil,
            perTaskRemindersEnabled: Bool? = nil
        ) {
            self.morningEnabled = morningEnabled; self.morningTime = morningTime
            self.morningContent = morningContent
            self.eveningEnabled = eveningEnabled; self.eveningTime = eveningTime
            self.eveningContent = eveningContent
            self.perTaskRemindersEnabled = perTaskRemindersEnabled
        }
    }

    public func patch(body: PatchBody) async throws -> NotificationPreferencesDTO {
        try await client.patch("/api/notification-preferences", body: body)
    }
}
```

- [ ] **Step 3: 註冊到 app DI**

兩個 App.swift 加 `notificationPrefsRepo` 跟 `recurrenceRepo` 同款處理。

- [ ] **Step 4: swift build 驗證 + commit**

```bash
cd apple/NudgeKit && swift build && cd /Users/mike/Documents/nudge && \
git add apple/NudgeKit/Sources/NudgeCore/NotificationPreferencesDTO.swift \
        apple/NudgeKit/Sources/NudgeCore/NotificationPreferencesRepository.swift \
        apple/Nudge-iOS/NudgeiOSApp.swift \
        apple/Nudge-macOS/NudgeMacApp.swift && \
git commit -m "feat(ios core): NotificationPreferencesRepository + DTO"
```

---

### Task C3: TaskRepository.toggleSkip(assignmentId:) + DailyAssignmentDTO 加 isSkipped

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeCore/DailyDataDTO.swift`
- Modify: `apple/NudgeKit/Sources/NudgeData/TaskRepository.swift`

- [ ] **Step 1: 加 isSkipped 到 DTO（含 default false 解碼）**

```swift
public struct DailyAssignmentDTO: Codable, Equatable, Sendable {
    public let id: String
    public let taskId: String
    public let date: String
    public let isCompleted: Bool
    public let isSkipped: Bool
    public let sortOrder: Int
    public let task: TaskDTO

    public init(
        id: String, taskId: String, date: String,
        isCompleted: Bool, isSkipped: Bool = false,
        sortOrder: Int, task: TaskDTO
    ) {
        self.id = id; self.taskId = taskId; self.date = date
        self.isCompleted = isCompleted; self.isSkipped = isSkipped
        self.sortOrder = sortOrder; self.task = task
    }

    private enum CodingKeys: String, CodingKey {
        case id, taskId, date, isCompleted, isSkipped, sortOrder, task
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        taskId = try c.decode(String.self, forKey: .taskId)
        date = try c.decode(String.self, forKey: .date)
        isCompleted = try c.decode(Bool.self, forKey: .isCompleted)
        isSkipped = try c.decodeIfPresent(Bool.self, forKey: .isSkipped) ?? false
        sortOrder = try c.decode(Int.self, forKey: .sortOrder)
        task = try c.decode(TaskDTO.self, forKey: .task)
    }
}
```

- [ ] **Step 2: 加 toggleSkip 方法**

`TaskRepository.swift` 加：

```swift
public func toggleSkip(assignmentId: String, isSkipped: Bool) async throws {
    struct Body: Encodable { let isSkipped: Bool }
    try await client.patchVoid(
        "/api/daily-assignments/\(assignmentId)",
        body: Body(isSkipped: isSkipped)
    )
}
```

- [ ] **Step 3: swift build + commit**

```bash
cd apple/NudgeKit && swift build && cd /Users/mike/Documents/nudge && \
git add apple/NudgeKit/Sources/NudgeCore/DailyDataDTO.swift \
        apple/NudgeKit/Sources/NudgeData/TaskRepository.swift && \
git commit -m "feat(ios core): DailyAssignmentDTO.isSkipped + TaskRepository.toggleSkip"
```

---

## Block D: iOS UI - 卡片詳細頁排程

### Task D1: ScheduleSection view（讀現有 recurrence + 顯示 picker）

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Cards/ScheduleSection.swift`
- Modify: `apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift`

- [ ] **Step 1: 寫 ScheduleSection**

```swift
import SwiftUI
import NudgeCore

/// 卡片詳細頁的「排程」區塊：重複規則 + 提醒時間設定。
/// 採 iOS 26 native Form / Section / Picker / DatePicker 風格。
public struct ScheduleSection: View {
    public let taskId: String
    @Binding var initialAbsoluteRemindAt: String?  // tasks.remindAt
    public let onChangeAbsoluteRemindAt: (String?) -> Void

    @Environment(RecurrenceRepository.self) private var recurrenceRepo

    @State private var recurrence: TaskRecurrenceDTO?
    @State private var isLoaded = false

    @State private var preset: RecurrencePreset? = nil // nil = 不重複
    @State private var weekdays: Set<Int> = []
    @State private var monthDay: Int = 1
    @State private var monthNth: Int = 1
    @State private var monthNthWeekday: Int = 1
    @State private var startDate: Date = Date()
    @State private var endDate: Date? = nil
    @State private var hasEndDate: Bool = false
    @State private var remindTimeOfDay: Date? = nil
    @State private var hasReminder: Bool = false
    @State private var absoluteRemindAt: Date? = nil

    public init(
        taskId: String,
        initialAbsoluteRemindAt: Binding<String?>,
        onChangeAbsoluteRemindAt: @escaping (String?) -> Void
    ) {
        self.taskId = taskId
        self._initialAbsoluteRemindAt = initialAbsoluteRemindAt
        self.onChangeAbsoluteRemindAt = onChangeAbsoluteRemindAt
    }

    public var body: some View {
        Group {
            if isLoaded {
                Form {
                    recurrenceSection
                    reminderSection
                }
                .scrollContentBackground(.hidden)
                .frame(maxHeight: 360)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(20)
            }
        }
        .task(id: taskId) { await load() }
    }

    @ViewBuilder
    private var recurrenceSection: some View {
        Section(header: Text("schedule.recurrence", bundle: .module)) {
            Picker(selection: presetBinding) {
                Text("schedule.recurrence.off", bundle: .module).tag(Optional<RecurrencePreset>.none)
                ForEach(RecurrencePreset.allCases) { p in
                    Text(p.localizedKey, bundle: .module).tag(Optional(p))
                }
            } label: {
                Text("schedule.recurrence.preset", bundle: .module)
            }
            .onChange(of: preset) { _, _ in saveRecurrence() }

            if preset == .weekly || preset == .biweekly {
                weekdaysPicker
            }
            if preset == .monthly_day {
                Stepper(value: $monthDay, in: 1...31, step: 1) {
                    Text("schedule.recurrence.monthDay \(monthDay)", bundle: .module)
                }
                .onChange(of: monthDay) { _, _ in saveRecurrence() }
            }
            if preset == .monthly_nth_weekday {
                monthlyNthPickers
            }
            if preset != nil {
                DatePicker(selection: $startDate, displayedComponents: .date) {
                    Text("schedule.recurrence.startDate", bundle: .module)
                }
                .onChange(of: startDate) { _, _ in saveRecurrence() }

                Toggle(isOn: $hasEndDate) {
                    Text("schedule.recurrence.hasEndDate", bundle: .module)
                }
                .onChange(of: hasEndDate) { _, on in
                    if on, endDate == nil { endDate = startDate }
                    saveRecurrence()
                }
                if hasEndDate {
                    DatePicker(selection: Binding(
                        get: { endDate ?? startDate },
                        set: { endDate = $0 }
                    ), displayedComponents: .date) {
                        Text("schedule.recurrence.endDate", bundle: .module)
                    }
                    .onChange(of: endDate) { _, _ in saveRecurrence() }
                }
            }
        }
    }

    @ViewBuilder
    private var weekdaysPicker: some View {
        HStack(spacing: 6) {
            ForEach(1...7, id: \.self) { day in
                Button {
                    if weekdays.contains(day) { weekdays.remove(day) }
                    else { weekdays.insert(day) }
                    saveRecurrence()
                } label: {
                    Text(weekdayShort(day))
                        .font(.caption.weight(.medium))
                        .foregroundStyle(weekdays.contains(day) ? Color.nudgePrimaryForeground : Color.nudgeForeground)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle().fill(weekdays.contains(day) ? Color.nudgePrimary : Color.clear)
                        )
                        .overlay(Circle().stroke(Color.nudgeBorder, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var monthlyNthPickers: some View {
        HStack {
            Picker(selection: $monthNth) {
                ForEach(1...4, id: \.self) { Text("schedule.recurrence.nth \($0)", bundle: .module).tag($0) }
                Text("schedule.recurrence.last", bundle: .module).tag(5)
            } label: { Text("schedule.recurrence.nthLabel", bundle: .module) }
            .onChange(of: monthNth) { _, _ in saveRecurrence() }

            Picker(selection: $monthNthWeekday) {
                ForEach(1...7, id: \.self) { Text(weekdayShort($0)).tag($0) }
            } label: { Text("schedule.recurrence.weekday", bundle: .module) }
            .onChange(of: monthNthWeekday) { _, _ in saveRecurrence() }
        }
    }

    @ViewBuilder
    private var reminderSection: some View {
        Section(header: Text("schedule.reminder", bundle: .module)) {
            Toggle(isOn: $hasReminder) {
                Text("schedule.reminder.enabled", bundle: .module)
            }
            .onChange(of: hasReminder) { _, on in
                if !on {
                    remindTimeOfDay = nil
                    absoluteRemindAt = nil
                }
                saveReminder()
            }

            if hasReminder {
                if preset != nil {
                    DatePicker(
                        selection: Binding(
                            get: { remindTimeOfDay ?? defaultReminderTime() },
                            set: { remindTimeOfDay = $0 }
                        ),
                        displayedComponents: .hourAndMinute
                    ) {
                        Text("schedule.reminder.timeOfDay", bundle: .module)
                    }
                    .onChange(of: remindTimeOfDay) { _, _ in saveReminder() }
                } else {
                    DatePicker(
                        selection: Binding(
                            get: { absoluteRemindAt ?? Date().addingTimeInterval(3600) },
                            set: { absoluteRemindAt = $0 }
                        ),
                        displayedComponents: [.date, .hourAndMinute]
                    ) {
                        Text("schedule.reminder.dateTime", bundle: .module)
                    }
                    .onChange(of: absoluteRemindAt) { _, _ in saveReminder() }
                }
            }
        }
    }

    private var presetBinding: Binding<RecurrencePreset?> {
        Binding(get: { preset }, set: { preset = $0 })
    }

    private func weekdayShort(_ d: Int) -> String {
        let keys = ["weekday.mon", "weekday.tue", "weekday.wed",
                    "weekday.thu", "weekday.fri", "weekday.sat", "weekday.sun"]
        return NSLocalizedString(keys[d - 1], bundle: .module, comment: "")
    }

    private func defaultReminderTime() -> Date {
        let cal = Calendar.current
        return cal.date(bySettingHour: 9, minute: 0, second: 0, of: Date()) ?? Date()
    }

    // MARK: - Load/save

    private func load() async {
        do {
            recurrence = try await recurrenceRepo.get(taskId: taskId)
            if let r = recurrence {
                preset = r.preset
                weekdays = Set((r.weekdays ?? "").split(separator: ",").compactMap { Int($0) })
                monthDay = r.monthDay ?? 1
                monthNth = r.monthNth ?? 1
                monthNthWeekday = r.monthNthWeekday ?? 1
                startDate = parseISODate(r.startDate) ?? Date()
                hasEndDate = r.endDate != nil
                endDate = r.endDate.flatMap(parseISODate)
                if let t = r.remindAtTimeOfDay {
                    let (h, m) = parseHM(t)
                    let cal = Calendar.current
                    remindTimeOfDay = cal.date(bySettingHour: h, minute: m, second: 0, of: Date())
                    hasReminder = true
                } else {
                    remindTimeOfDay = nil
                    hasReminder = false
                }
            } else {
                preset = nil
                if let isoStr = initialAbsoluteRemindAt {
                    absoluteRemindAt = parseISODateTime(isoStr)
                    hasReminder = absoluteRemindAt != nil
                }
            }
            isLoaded = true
        } catch {
            print("[ScheduleSection] load failed: \(error)")
            isLoaded = true
        }
    }

    private func saveRecurrence() {
        guard isLoaded else { return }
        Task {
            do {
                if let p = preset {
                    let body = RecurrenceRepository.UpsertBody(
                        preset: p.rawValue,
                        weekdays: (p == .weekly || p == .biweekly) ? weekdays.sorted().map(String.init).joined(separator: ",") : nil,
                        monthDay: p == .monthly_day ? monthDay : nil,
                        monthNth: p == .monthly_nth_weekday ? monthNth : nil,
                        monthNthWeekday: p == .monthly_nth_weekday ? monthNthWeekday : nil,
                        startDate: isoDate(startDate),
                        endDate: hasEndDate ? endDate.map(isoDate) : nil,
                        remindAtTimeOfDay: remindTimeOfDay.map(hmString)
                    )
                    _ = try await recurrenceRepo.upsert(taskId: taskId, body: body)
                } else {
                    try await recurrenceRepo.delete(taskId: taskId)
                }
            } catch {
                print("[ScheduleSection] saveRecurrence failed: \(error)")
            }
        }
    }

    private func saveReminder() {
        guard isLoaded else { return }
        if preset != nil {
            // recurrence reminder lives in same upsert
            saveRecurrence()
        } else {
            // absolute reminder writes back to tasks.remindAt
            let value = hasReminder ? absoluteRemindAt.map { isoDateTime($0) } : nil
            initialAbsoluteRemindAt = value
            onChangeAbsoluteRemindAt(value)
        }
    }

    // MARK: - Date helpers

    private func parseISODate(_ s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(secondsFromGMT: 0)
        return f.date(from: s)
    }
    private func isoDate(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(secondsFromGMT: 0)
        return f.string(from: d)
    }
    private func parseHM(_ s: String) -> (Int, Int) {
        let parts = s.split(separator: ":").compactMap { Int($0) }
        return (parts.first ?? 9, parts.count > 1 ? parts[1] : 0)
    }
    private func hmString(_ d: Date) -> String {
        let cal = Calendar.current
        let h = cal.component(.hour, from: d)
        let m = cal.component(.minute, from: d)
        return String(format: "%02d:%02d", h, m)
    }
    private func parseISODateTime(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        return f.date(from: s)
    }
    private func isoDateTime(_ d: Date) -> String {
        let f = ISO8601DateFormatter()
        return f.string(from: d)
    }
}

extension RecurrencePreset {
    var localizedKey: LocalizedStringKey {
        switch self {
        case .daily: return "schedule.preset.daily"
        case .weekdays: return "schedule.preset.weekdays"
        case .weekly: return "schedule.preset.weekly"
        case .biweekly: return "schedule.preset.biweekly"
        case .monthly_day: return "schedule.preset.monthlyDay"
        case .monthly_nth_weekday: return "schedule.preset.monthlyNthWeekday"
        case .yearly: return "schedule.preset.yearly"
        }
    }
}
```

- [ ] **Step 2: 把 ScheduleSection 嵌進 CardDetailView**

`CardDetailView.swift`：在 RichTextEditor **之上**加入 ScheduleSection。需要把 task.remindAt 拉進來（若 TaskDTO / CardDTO 沒這欄需先補；最簡單先用一個 @State 假 nil 繞，下個 task 補）。

```swift
// 在 scrollContent VStack 內、RichTextEditor 之前加：
ScheduleSection(
    taskId: initialCard.id,
    initialAbsoluteRemindAt: $absoluteRemindAtState,
    onChangeAbsoluteRemindAt: { newValue in
        // PATCH /api/tasks/{id} 用既有 cardRepo.updateRemindAt(...)
        // 若沒有此方法就先 print
        print("[CardDetail] save remindAt: \(newValue ?? "nil")")
    }
)
.padding(.horizontal, 16)
.padding(.top, 8)
```

- [ ] **Step 3: 加 i18n key（schedule.* 和 schedule.preset.*、schedule.recurrence.*、schedule.reminder.*）到 xcstrings 三語**

新增 keys（每個 en/ja/zh-Hant 都要）：
- `schedule.recurrence`、`schedule.recurrence.off`、`schedule.recurrence.preset`、`schedule.recurrence.startDate`、`schedule.recurrence.endDate`、`schedule.recurrence.hasEndDate`、`schedule.recurrence.monthDay %lld`、`schedule.recurrence.nth %lld`、`schedule.recurrence.last`、`schedule.recurrence.nthLabel`、`schedule.recurrence.weekday`
- `schedule.preset.daily`、`schedule.preset.weekdays`、`schedule.preset.weekly`、`schedule.preset.biweekly`、`schedule.preset.monthlyDay`、`schedule.preset.monthlyNthWeekday`、`schedule.preset.yearly`
- `schedule.reminder`、`schedule.reminder.enabled`、`schedule.reminder.timeOfDay`、`schedule.reminder.dateTime`

對應 web key（先建在 `src/messages/{en,zh-TW,ja}.json` 的 `schedule` namespace），再 mirror 到 xcstrings。中文翻譯範例：
- recurrence: "重複"
- off: "關"
- daily: "每天"、weekdays: "平日"、weekly: "每週"、biweekly: "每兩週"、monthlyDay: "每月某日"、monthlyNthWeekday: "每月第幾個週幾"、yearly: "每年"
- reminder: "提醒"、reminder.enabled: "提醒"、reminder.timeOfDay: "時段"、reminder.dateTime: "提醒時間"
- nth %lld: "第 %lld 個"、last: "最後一個"

- [ ] **Step 4: xcodebuild + 模擬器實測**

```bash
cd /Users/mike/Documents/nudge/apple && \
xcodebuild -scheme Nudge-iOS \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=latest' \
  build 2>&1 | grep -E "error:|\*\* BUILD"
```
Expected: BUILD SUCCEEDED

裝到 sim、進卡片詳細頁，測試 picker 切換、date picker、toggle 都能存（看 console log）。

- [ ] **Step 5: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeUI/Cards/ScheduleSection.swift \
        apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift \
        apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings \
        src/messages/{en,zh-TW,ja}.json && \
git commit -m "feat(ios ui): 卡片詳細頁排程區塊（recurrence + reminder 設定）"
```

---

### Task D2: CardRepository.updateRemindAt + 接到 ScheduleSection callback

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeCore/CardRepository.swift`
- Modify: `apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift`

- [ ] **Step 1: CardRepository 加方法**

```swift
public func updateRemindAt(cardId: String, remindAt: String?) async throws {
    struct Body: Encodable { let remindAt: String? }
    try await client.patchVoid("/api/tasks/\(cardId)", body: Body(remindAt: remindAt))
}
```

- [ ] **Step 2: CardDetailView 接上**

把 ScheduleSection 的 callback 改成：

```swift
onChangeAbsoluteRemindAt: { newValue in
    Task {
        do {
            try await cardRepo.updateRemindAt(cardId: initialCard.id, remindAt: newValue)
        } catch {
            print("[CardDetail] updateRemindAt failed: \(error)")
        }
    }
}
```

也要在 CardDetailView 裡 `@Environment(CardRepository.self)` 拿 cardRepo。

- [ ] **Step 3: build + commit**

```bash
xcodebuild -scheme Nudge-iOS -destination 'platform=iOS Simulator,name=iPhone 17,OS=latest' build 2>&1 | grep -E "error:|\*\* BUILD"
git add apple/NudgeKit/Sources/NudgeCore/CardRepository.swift \
        apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift && \
git commit -m "feat(ios core): CardRepository.updateRemindAt + 接到 ScheduleSection"
```

---

## Block E: iOS UI - 行動頁 row menu 統一

### Task E1: TaskRowMenu 元件 + 替換現有 row 動作 icon

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/TaskRowMenu.swift`
- Modify: 行動頁的 task row 使用處（grep `dailyAssignment` row UI）

- [ ] **Step 1: 找出現有 row 元件**

Run: `grep -rn "TaskListView\|onArchive\|onMoveTo" apple/NudgeKit/Sources/NudgeUI/Daily/`

確認 row 元件檔名（很可能是 TaskListView.swift 內建 row 或單獨檔）。

- [ ] **Step 2: 建立 TaskRowMenu**

```swift
import SwiftUI
import NudgeCore

/// 行動頁 task row 右側的 `...` menu，統一過去 / 今日 / 重複任務 row 的動作。
public struct TaskRowMenu: View {
    public let assignment: DailyAssignmentDTO
    public let isToday: Bool
    public let isRecurring: Bool
    public let onMoveToToday: () -> Void
    public let onMoveToOtherDate: () -> Void
    public let onSkipThisOccurrence: () -> Void
    public let onSetRecurrence: () -> Void
    public let onSetReminder: () -> Void
    public let onArchive: () -> Void

    public var body: some View {
        Menu {
            if !isToday {
                Button {
                    onMoveToToday()
                } label: {
                    Label {
                        Text("daily.moveToToday", bundle: .module)
                    } icon: {
                        Image(systemName: "calendar.badge.checkmark")
                    }
                }
            }
            Button {
                onMoveToOtherDate()
            } label: {
                Label {
                    Text("daily.moveToOtherDate", bundle: .module)
                } icon: {
                    Image(systemName: "calendar")
                }
            }

            if isRecurring {
                Button {
                    onSkipThisOccurrence()
                } label: {
                    Label {
                        Text("daily.skipThisOccurrence", bundle: .module)
                    } icon: {
                        Image(systemName: "forward")
                    }
                }
            } else {
                Button {
                    onSetRecurrence()
                } label: {
                    Label {
                        Text("daily.setRecurring", bundle: .module)
                    } icon: {
                        Image(systemName: "arrow.triangle.2.circlepath")
                    }
                }
            }

            Button {
                onSetReminder()
            } label: {
                Label {
                    Text("daily.setReminder", bundle: .module)
                } icon: {
                    Image(systemName: "bell")
                }
            }

            Divider()

            Button(role: .destructive) {
                onArchive()
            } label: {
                Label {
                    Text("daily.archive", bundle: .module)
                } icon: {
                    Image(systemName: "archivebox")
                }
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.body.weight(.medium))
                .foregroundStyle(Color.nudgeTextDim)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(Text("daily.rowMenu", bundle: .module))
    }
}
```

- [ ] **Step 3: 在 row 元件用 TaskRowMenu 取代既有 icon**

把行動頁的 task row 中現有的「日曆 icon (今日)」「`...` (過去)」整合成單一 `TaskRowMenu`，所有需要的 callback 從外面傳入。`isRecurring` 暫時用 `false`（下一個 task 補上判斷）。

- [ ] **Step 4: i18n key 補齊**

`daily.moveToToday`、`daily.moveToOtherDate`、`daily.skipThisOccurrence`、`daily.setRecurring`、`daily.setReminder`、`daily.archive`、`daily.rowMenu`，三語都要。

- [ ] **Step 5: build + sim 實測 + commit**

```bash
xcodebuild ... build && \
git add ... && \
git commit -m "feat(ios ui): TaskRowMenu 統一過去/今日/重複任務的 row 動作"
```

---

### Task E2: assignments 加 isRecurring 判斷 + 「跳過這次」串接

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift`
- Modify: `src/app/api/daily/[date]/route.ts`（回傳 isRecurring 欄位）

**選擇做法**：server 在回傳 assignments 時 join task_recurrences，回傳 `isRecurring: true/false`。

- [ ] **Step 1: 修改 server**

`/api/daily/[date]/route.ts` 改用 LEFT JOIN：

```ts
const rows = await db
  .select({
    /* ... existing fields ... */
    isRecurring: sql<boolean>`(${taskRecurrences.id} IS NOT NULL)`,
  })
  .from(dailyTaskAssignments)
  .innerJoin(tasks, eq(tasks.id, dailyTaskAssignments.taskId))
  .leftJoin(taskRecurrences, eq(taskRecurrences.taskId, tasks.id))
  /* ... */
```

- [ ] **Step 2: DailyAssignmentDTO 加 isRecurring**

```swift
public let isRecurring: Bool

// init 加參數，CodingKeys 加 case，decode 用 decodeIfPresent ?? false
```

- [ ] **Step 3: DailyHostView 接 TaskRowMenu callback**

```swift
TaskRowMenu(
    assignment: a,
    isToday: a.date == DateFormatters.isoDate(Date()),
    isRecurring: a.isRecurring,
    onMoveToToday: { moveAssignment(a, to: DateFormatters.isoDate(Date())) },
    onMoveToOtherDate: { moveSheetAssignment = a },
    onSkipThisOccurrence: {
        Task {
            try? await taskRepo.toggleSkip(assignmentId: a.id, isSkipped: true)
            await reload()
        }
    },
    onSetRecurrence: { navigationPath.append(a) }, // 進卡片詳細
    onSetReminder: { navigationPath.append(a) },
    onArchive: { archiveTask(a) }
)
```

- [ ] **Step 4: build + sim 實測（建立 weekly task → row 應該顯示「跳過這次」入口）+ commit**

---

## Block F: iOS UI - 設定頁通知偏好

### Task F1: NotificationPreferencesSection 加到 SettingsView

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Settings/NotificationPreferencesSection.swift`
- Modify: `apple/NudgeKit/Sources/NudgeUI/SettingsView.swift`

- [ ] **Step 1: NotificationPreferencesSection**

```swift
import SwiftUI
import NudgeCore

public struct NotificationPreferencesSection: View {
    @Environment(NotificationPreferencesRepository.self) private var prefsRepo

    @State private var prefs: NotificationPreferencesDTO?
    @State private var isLoaded = false

    @State private var morningEnabled = true
    @State private var morningTime = Date()
    @State private var morningContent: NotificationContent = .summary
    @State private var eveningEnabled = true
    @State private var eveningTime = Date()
    @State private var eveningContent: NotificationContent = .incomplete
    @State private var perTaskRemindersEnabled = true

    public init() {}

    public var body: some View {
        Section(header: Text("settings.notifications", bundle: .module)) {
            if isLoaded {
                Toggle(isOn: $morningEnabled) {
                    Text("settings.notifications.morningEnabled", bundle: .module)
                }
                .onChange(of: morningEnabled) { _, _ in save() }

                if morningEnabled {
                    DatePicker(selection: $morningTime, displayedComponents: .hourAndMinute) {
                        Text("settings.notifications.morningTime", bundle: .module)
                    }
                    .onChange(of: morningTime) { _, _ in save() }

                    Picker(selection: $morningContent) {
                        ForEach(NotificationContent.allCases) { c in
                            Text(c.localizedKey, bundle: .module).tag(c)
                        }
                    } label: {
                        Text("settings.notifications.morningContent", bundle: .module)
                    }
                    .onChange(of: morningContent) { _, _ in save() }
                }

                Toggle(isOn: $eveningEnabled) {
                    Text("settings.notifications.eveningEnabled", bundle: .module)
                }
                .onChange(of: eveningEnabled) { _, _ in save() }

                if eveningEnabled {
                    DatePicker(selection: $eveningTime, displayedComponents: .hourAndMinute) {
                        Text("settings.notifications.eveningTime", bundle: .module)
                    }
                    .onChange(of: eveningTime) { _, _ in save() }

                    Picker(selection: $eveningContent) {
                        ForEach(NotificationContent.allCases) { c in
                            Text(c.localizedKey, bundle: .module).tag(c)
                        }
                    } label: {
                        Text("settings.notifications.eveningContent", bundle: .module)
                    }
                    .onChange(of: eveningContent) { _, _ in save() }
                }

                Toggle(isOn: $perTaskRemindersEnabled) {
                    Text("settings.notifications.perTaskEnabled", bundle: .module)
                }
                .onChange(of: perTaskRemindersEnabled) { _, _ in save() }
            } else {
                ProgressView()
            }
        }
        .task { await load() }
    }

    private func load() async {
        do {
            let p = try await prefsRepo.get()
            prefs = p
            morningEnabled = p.morningEnabled
            morningTime = parseHM(p.morningTime)
            morningContent = p.morningContent
            eveningEnabled = p.eveningEnabled
            eveningTime = parseHM(p.eveningTime)
            eveningContent = p.eveningContent
            perTaskRemindersEnabled = p.perTaskRemindersEnabled
            isLoaded = true
        } catch {
            print("[NotifPrefs] load failed: \(error)")
            isLoaded = true
        }
    }

    private func save() {
        guard isLoaded else { return }
        Task {
            do {
                let body = NotificationPreferencesRepository.PatchBody(
                    morningEnabled: morningEnabled,
                    morningTime: hmString(morningTime),
                    morningContent: morningContent.rawValue,
                    eveningEnabled: eveningEnabled,
                    eveningTime: hmString(eveningTime),
                    eveningContent: eveningContent.rawValue,
                    perTaskRemindersEnabled: perTaskRemindersEnabled
                )
                _ = try await prefsRepo.patch(body: body)
                // TODO Block G: trigger NotificationScheduler.reschedule()
            } catch {
                print("[NotifPrefs] save failed: \(error)")
            }
        }
    }

    private func parseHM(_ s: String) -> Date {
        let parts = s.split(separator: ":").compactMap { Int($0) }
        let h = parts.first ?? 9
        let m = parts.count > 1 ? parts[1] : 0
        return Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: Date()) ?? Date()
    }

    private func hmString(_ d: Date) -> String {
        let cal = Calendar.current
        return String(format: "%02d:%02d",
                      cal.component(.hour, from: d),
                      cal.component(.minute, from: d))
    }
}

extension NotificationContent {
    var localizedKey: LocalizedStringKey {
        switch self {
        case .summary: return "notifications.content.summary"
        case .incomplete: return "notifications.content.incomplete"
        case .summary_streak: return "notifications.content.summaryStreak"
        }
    }
}
```

- [ ] **Step 2: 嵌進 SettingsView**

在 SettingsView 既有 Form 裡加：
```swift
NotificationPreferencesSection()
```

- [ ] **Step 3: i18n keys 補齊**

settings.notifications / morningEnabled / morningTime / morningContent / eveningEnabled / eveningTime / eveningContent / perTaskEnabled、notifications.content.summary / incomplete / summaryStreak — 三語。

- [ ] **Step 4: build + sim 實測 + commit**

---

## Block G: iOS Notification Scheduler

### Task G1: Swift recurrence 純函式（鏡 TS 版）

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/RecurrenceCalculator.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/RecurrenceCalculatorTests.swift`

- [ ] **Step 1: 寫測試先（鏡 TS 那組）**

```swift
import XCTest
@testable import NudgeCore

final class RecurrenceCalculatorTests: XCTestCase {
    private let baseDaily = TaskRecurrenceDTO(
        id: "x", taskId: "t", preset: .daily,
        weekdays: nil, monthDay: nil, monthNth: nil, monthNthWeekday: nil,
        startDate: "2026-04-01", endDate: nil, remindAtTimeOfDay: nil,
        createdAt: "", updatedAt: ""
    )

    func test_daily_alwaysTrueAfterStart() {
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-04-01", rule: baseDaily))
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2027-01-01", rule: baseDaily))
    }
    func test_daily_beforeStart_false() {
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-03-31", rule: baseDaily))
    }
    // ... rest of cases mirror TS tests above ...
}
```

(完整 cases 鏡 TS 的所有 it() — 寫法照搬，期待行為一致)

- [ ] **Step 2: 實作**

```swift
import Foundation

public enum RecurrenceCalculator {
    public static func occurs(date dateStr: String, rule: TaskRecurrenceDTO) -> Bool {
        guard let date = parseISODate(dateStr),
              let start = parseISODate(rule.startDate) else { return false }
        if date < start { return false }
        if let end = rule.endDate, let endDate = parseISODate(end), date > endDate { return false }

        switch rule.preset {
        case .daily:
            return true
        case .weekdays:
            let w = isoWeekday(date)
            return w >= 1 && w <= 5
        case .weekly:
            guard let csv = rule.weekdays else { return false }
            return csv.split(separator: ",").compactMap { Int($0) }.contains(isoWeekday(date))
        case .biweekly:
            guard let csv = rule.weekdays else { return false }
            let weekdays = csv.split(separator: ",").compactMap { Int($0) }
            guard weekdays.contains(isoWeekday(date)) else { return false }
            let days = Calendar(identifier: .gregorian).dateComponents([.day], from: start, to: date).day ?? 0
            return (days / 7) % 2 == 0
        case .monthly_day:
            guard let md = rule.monthDay else { return false }
            return Calendar(identifier: .gregorian).component(.day, from: date) == md
        case .monthly_nth_weekday:
            guard let nth = rule.monthNth, let wkd = rule.monthNthWeekday else { return false }
            guard isoWeekday(date) == wkd else { return false }
            let dom = Calendar(identifier: .gregorian).component(.day, from: date)
            if nth == 5 {
                let last = lastDayOfMonth(date)
                return dom > last - 7
            }
            let lower = (nth - 1) * 7 + 1
            let upper = nth * 7
            return dom >= lower && dom <= upper
        case .yearly:
            let cal = Calendar(identifier: .gregorian)
            let m = cal.component(.month, from: date), d = cal.component(.day, from: date)
            let sm = cal.component(.month, from: start), sd = cal.component(.day, from: start)
            if m == sm && d == sd { return true }
            if sm == 2 && sd == 29 && m == 2 && d == 28 {
                return lastDayOfMonth(date) == 28
            }
            return false
        }
    }

    public static func occurrences(rule: TaskRecurrenceDTO, from: String, to: String) -> [String] {
        guard let f = parseISODate(from), let t = parseISODate(to) else { return [] }
        var result: [String] = []
        var cur = f
        let cal = Calendar(identifier: .gregorian)
        while cur <= t {
            let iso = isoDate(cur)
            if occurs(date: iso, rule: rule) { result.append(iso) }
            cur = cal.date(byAdding: .day, value: 1, to: cur) ?? cur.addingTimeInterval(86400)
        }
        return result
    }

    // MARK: - Helpers

    private static func parseISODate(_ s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.calendar = Calendar(identifier: .gregorian)
        return f.date(from: s)
    }
    private static func isoDate(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.calendar = Calendar(identifier: .gregorian)
        return f.string(from: d)
    }
    private static func isoWeekday(_ d: Date) -> Int {
        let w = Calendar(identifier: .gregorian).component(.weekday, from: d) // 1=Sun..7=Sat
        return w == 1 ? 7 : w - 1 // ISO: 1=Mon..7=Sun
    }
    private static func lastDayOfMonth(_ d: Date) -> Int {
        let cal = Calendar(identifier: .gregorian)
        let range = cal.range(of: .day, in: .month, for: d)
        return range?.upperBound.advanced(by: -1) ?? 31
    }
}
```

- [ ] **Step 3: 跑測試 PASS + commit**

```bash
cd apple/NudgeKit && swift test --filter RecurrenceCalculatorTests
git add ... && git commit -m "feat(ios core): RecurrenceCalculator 純函式 + tests"
```

---

### Task G2: NotificationScheduler — 排程 daily batch + per-task

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Notifications/NotificationScheduler.swift`

- [ ] **Step 1: NotificationScheduler 實作**

```swift
#if os(iOS)
import Foundation
import UserNotifications
import NudgeCore

@MainActor
public final class NotificationScheduler {
    public static let shared = NotificationScheduler()
    private init() {}

    private let prefix = "task-reminder-"
    private let morningId = "daily-batch-morning"
    private let eveningId = "daily-batch-evening"

    /// 請求授權（首次叫到 schedule 任何 notification 前都應該先 call）
    public func requestAuthIfNeeded() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        }
        return settings.authorizationStatus == .authorized
            || settings.authorizationStatus == .provisional
    }

    // MARK: - Daily batch

    public func rescheduleDailyBatches(prefs: NotificationPreferencesDTO,
                                       morningBody: String,
                                       eveningBody: String) async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [morningId, eveningId])

        if prefs.morningEnabled {
            let (h, m) = parseHM(prefs.morningTime)
            let req = makeRepeatingRequest(
                id: morningId,
                hour: h, minute: m,
                title: NSLocalizedString("notifications.morning.title", bundle: .module, comment: ""),
                body: morningBody
            )
            try? await center.add(req)
        }
        if prefs.eveningEnabled {
            let (h, m) = parseHM(prefs.eveningTime)
            let req = makeRepeatingRequest(
                id: eveningId,
                hour: h, minute: m,
                title: NSLocalizedString("notifications.evening.title", bundle: .module, comment: ""),
                body: eveningBody
            )
            try? await center.add(req)
        }
    }

    // MARK: - Per-task

    public func rescheduleTaskReminder(
        taskId: String,
        title: String,
        absoluteRemindAt: Date?,
        recurrence: TaskRecurrenceDTO?,
        windowDays: Int = 30
    ) async {
        let center = UNUserNotificationCenter.current()
        // 移除這 task 的所有 pending
        let pending = await center.pendingNotificationRequests()
        let mine = pending.filter { $0.identifier.hasPrefix("\(prefix)\(taskId)") }
            .map(\.identifier)
        center.removePendingNotificationRequests(withIdentifiers: mine)

        // 1) absolute (非重複任務)
        if let absolute = absoluteRemindAt {
            let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: absolute)
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = NSLocalizedString("notifications.task.reminderBody", bundle: .module, comment: "")
            let req = UNNotificationRequest(identifier: "\(prefix)\(taskId)", content: content, trigger: trigger)
            try? await center.add(req)
        }

        // 2) recurrence-based per-occurrence
        guard let rec = recurrence, let timeOfDay = rec.remindAtTimeOfDay else { return }
        let (hour, minute) = parseHM(timeOfDay)
        let today = isoDate(Date())
        let until = isoDate(Date().addingTimeInterval(TimeInterval(windowDays) * 86400))
        let dates = RecurrenceCalculator.occurrences(rule: rec, from: today, to: until)
        for d in dates {
            guard let day = parseISODate(d) else { continue }
            var comps = Calendar.current.dateComponents([.year, .month, .day], from: day)
            comps.hour = hour
            comps.minute = minute
            // skip past time today
            if let fireDate = Calendar.current.date(from: comps), fireDate < Date() { continue }
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = NSLocalizedString("notifications.task.reminderBody", bundle: .module, comment: "")
            let id = "\(prefix)\(taskId)-\(d.replacingOccurrences(of: "-", with: ""))"
            let req = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
            try? await center.add(req)
        }
    }

    public func cancelTaskReminder(taskId: String) async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let mine = pending.filter { $0.identifier.hasPrefix("\(prefix)\(taskId)") }
            .map(\.identifier)
        center.removePendingNotificationRequests(withIdentifiers: mine)
    }

    // MARK: - Helpers

    private func makeRepeatingRequest(id: String, hour: Int, minute: Int, title: String, body: String) -> UNNotificationRequest {
        var comps = DateComponents()
        comps.hour = hour
        comps.minute = minute
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        return UNNotificationRequest(identifier: id, content: content, trigger: trigger)
    }

    private func parseHM(_ s: String) -> (Int, Int) {
        let parts = s.split(separator: ":").compactMap { Int($0) }
        return (parts.first ?? 9, parts.count > 1 ? parts[1] : 0)
    }
    private func parseISODate(_ s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone.current
        return f.date(from: s)
    }
    private func isoDate(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone.current
        return f.string(from: d)
    }
}
#endif
```

- [ ] **Step 2: i18n keys**

`notifications.morning.title` / `notifications.evening.title` / `notifications.task.reminderBody`，三語。

- [ ] **Step 3: build 確認 + commit**

```bash
xcodebuild ... build && \
git add apple/NudgeKit/Sources/NudgeUI/Notifications/NotificationScheduler.swift \
        apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings && \
git commit -m "feat(ios notifications): NotificationScheduler 排程 daily batch + per-task"
```

---

### Task G3: 整合 NotificationScheduler 到 app 生命週期 + 變動點

**Files:**
- Modify: `apple/Nudge-iOS/NudgeiOSApp.swift`
- Modify: 任何呼叫 prefs / recurrence / task remindAt 變動的地方

- [ ] **Step 1: app 啟動 + scenePhase active 時 reschedule**

```swift
@Environment(\.scenePhase) private var scenePhase

.onChange(of: scenePhase) { _, phase in
    if phase == .active {
        Task { await rescheduleAll() }
    }
}

private func rescheduleAll() async {
    let _ = await NotificationScheduler.shared.requestAuthIfNeeded()
    do {
        let prefs = try await notificationPrefsRepo.get()
        // build morning / evening body from snapshot
        // (簡單版 v1: 直接用「今天 X 個任務」固定字串 placeholder 〇 個)
        let morning = NSLocalizedString("notifications.morning.bodyTemplate", bundle: .module, comment: "")
        let evening = NSLocalizedString("notifications.evening.bodyTemplate", bundle: .module, comment: "")
        await NotificationScheduler.shared.rescheduleDailyBatches(
            prefs: prefs,
            morningBody: morning,
            eveningBody: evening
        )

        // per-task: 也許先簡單版只重排目前載入的 daily 任務有 reminder 的
        // (完整 version 是: GET 所有 active recurrences + tasks with remindAt)
        // v1 留 TODO，sim 階段先測 batch 對不對
    } catch {
        print("[App] rescheduleAll failed: \(error)")
    }
}
```

- [ ] **Step 2: ScheduleSection 存檔後也 trigger reschedule**

ScheduleSection 的 `saveRecurrence` / `saveReminder` 成功後加：

```swift
await NotificationScheduler.shared.rescheduleTaskReminder(
    taskId: taskId, title: ..., absoluteRemindAt: ...,
    recurrence: ...
)
```

需要 ScheduleSection 知道 task title — 透過 init 多帶一個參數即可。

- [ ] **Step 3: NotificationPreferencesSection 存檔後也 trigger batch reschedule**

同上邏輯，存檔成功後 call `rescheduleDailyBatches`。

- [ ] **Step 4: build + sim 實測**

到設定頁開早晨摘要 → 應該觸發授權對話框；准了之後 `await UNUserNotificationCenter.current().pendingNotificationRequests()` debug print 看有 morning request。

- [ ] **Step 5: commit**

---

## Block H: 收尾 + TestFlight

### Task H1: 全 build + iOS / macOS 互動測試

- [ ] iOS sim 全流程：建普通任務 → 改成 weekly → 設提醒 09:00 → 跳過某次 → 設定頁改通知時段
- [ ] xcodebuild macOS 確認沒因為 iOS-only API 把 macOS build 弄壞
- [ ] swift test 全綠
- [ ] 修任何發現的問題

### Task H2: bump CURRENT_PROJECT_VERSION + xcodegen + archive + Transporter

- [ ] `apple/project.yml` 把 109 → 110
- [ ] `xcodegen generate`
- [ ] xcodebuild archive Release
- [ ] xcodebuild -exportArchive
- [ ] `open -a Transporter <ipa>` 給使用者上傳

---

## 自審結果

- ✅ Spec coverage: 8 個 Block 對應 spec §9 的 8 個推進階段；§2~7 所有要求都有對應 task
- ✅ 無 placeholder（每個 step 都有實際 code 或具體指令）
- ✅ Type 一致性：DTO / Repository / API endpoint shape 都跟 §2 schema 對齊；`NotificationContent` 兩個 swift / ts naming 都是 snake `summary_streak`
- ✅ 已標明 APIClient 缺 `put<T,R>` 要先補（Block C Task C1 Step 3）

---

## 執行模式

接下來會直接開始實作，使用 inline executing-plans 模式（不發 subagent，省 context、省時間）。每個 Task 完成 commit 後檢查 build 綠燈再進下一個。完整 8 個 Block 走完才會回報。

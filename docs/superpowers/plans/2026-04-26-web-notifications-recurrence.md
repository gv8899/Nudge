# Web 子題 #1：通知偏好 + 重複任務 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web 端補上通知偏好設定、重複任務 CRUD、跳過某次發生這 3 個 backend 已就緒但 UI 缺席的功能。

**Architecture:** 一個共用 `<ScheduleSection>` 核心元件，被 card detail page (inline) 與 row context menu (Dialog) 共用。Settings modal 加 `<NotificationsSection>` 與既有 sections 並列。3 個新 SWR hook 包裝 fetch / save。任務 row 用 base-ui DropdownMenu + onContextMenu 提供 quick actions。

**Tech Stack:** Next.js 16, React 19, TypeScript, SWR, `@base-ui/react` (Dialog / Menu / Input), Tailwind v4, next-intl, vitest, Drizzle ORM。

---

## Spec Reference

`docs/superpowers/specs/2026-04-26-web-notifications-recurrence-design.md`

## File Structure

```
src/
  components/
    settings/
      notifications-section.tsx        新 — Settings modal 的「通知」section
    task/
      schedule-section.tsx             新 — 重複規則 + 提醒時間 核心 UI
      schedule-dialog.tsx              新 — Dialog 包裝
      skip-confirmation-dialog.tsx     新 — 跳過確認 AlertDialog
  lib/
    hooks/
      use-notification-preferences.ts  新 — SWR GET/PATCH preferences
      use-task-recurrence.ts           新 — SWR GET/PUT recurrence
    schedule-validation.ts             新 — pure functions (TDD)
    schedule-validation.test.ts        新 — vitest unit tests
  components/settings/settings-modal.tsx       修改 — 插入 NotificationsSection
  components/cards/card-detail.tsx              修改 — 插入 ScheduleSection
  components/task/task-card.tsx                 修改 — 加 … menu + 右鍵 menu
  messages/{en,ja,zh-TW}.json                   修改 — 補 i18n keys
```

---

## Task 1: 補 i18n keys（schedule + skip + notifications platform note）

**Files:**
- Modify: `src/messages/en.json`
- Modify: `src/messages/ja.json`
- Modify: `src/messages/zh-TW.json`

**Background:** 既有的 `settings.notifications.*`、`notifications.content.*`、`schedule.recurrence.off / startDate / endDate / hasEndDate / monthDayN` 已存在。這個 task 補齊：

- `settings.notifications.platformNote` — 「推播在 iOS app 接收。Web 僅做設定」說明
- `schedule.recurrence.daily` / `weekly` / `biweekly` / `monthlyDay` / `monthlyNthWeekday`
- `schedule.recurrence.weekdays` (label)
- `schedule.recurrence.weekdayShort.{sun..sat}` (chip 內容)
- `schedule.recurrence.nthN`、`schedule.recurrence.nthLabel`、`schedule.recurrence.weekday`、`schedule.recurrence.last`
- `schedule.reminder.label`、`schedule.reminder.placeholder`、`schedule.reminder.clear`
- `schedule.validation.endBeforeStart`、`schedule.validation.weeklyNeedsWeekday`
- `daily.setRecurring`、`daily.skipThisOccurrence`、`daily.setReminder`
- `daily.skipConfirmTitle`、`daily.skipConfirmBody {title}`、`daily.skipConfirmAction`
- `common.cancel`、`common.save`（如不存在）
- `common.errorSaving`（toast）

- [ ] **Step 1: 用 Python 一次補三語言**

```bash
python3 << 'EOF'
import json
TARGETS = {
  "en": "/Users/mike/Documents/nudge/src/messages/en.json",
  "ja": "/Users/mike/Documents/nudge/src/messages/ja.json",
  "zh-TW": "/Users/mike/Documents/nudge/src/messages/zh-TW.json",
}
NEW = {
  "en": {
    "settings.notifications.platformNote": "Push notifications are delivered by the iOS app. Web is for configuration only.",
    "schedule.recurrence.daily": "Daily",
    "schedule.recurrence.weekly": "Weekly",
    "schedule.recurrence.biweekly": "Every two weeks",
    "schedule.recurrence.monthlyDay": "Monthly on day",
    "schedule.recurrence.monthlyNthWeekday": "Monthly on Nth weekday",
    "schedule.recurrence.weekdays": "Weekdays",
    "schedule.recurrence.nthN": "{n}th",
    "schedule.recurrence.nthLabel": "Position",
    "schedule.recurrence.weekday": "Weekday",
    "schedule.recurrence.last": "Last",
    "schedule.reminder.label": "Reminder time",
    "schedule.reminder.placeholder": "No reminder",
    "schedule.reminder.clear": "Clear",
    "schedule.validation.endBeforeStart": "End date must be after start date.",
    "schedule.validation.weeklyNeedsWeekday": "Pick at least one weekday.",
    "schedule.recurrence.weekdayShort.sun": "Sun",
    "schedule.recurrence.weekdayShort.mon": "Mon",
    "schedule.recurrence.weekdayShort.tue": "Tue",
    "schedule.recurrence.weekdayShort.wed": "Wed",
    "schedule.recurrence.weekdayShort.thu": "Thu",
    "schedule.recurrence.weekdayShort.fri": "Fri",
    "schedule.recurrence.weekdayShort.sat": "Sat",
    "daily.setRecurring": "Set as recurring",
    "daily.skipThisOccurrence": "Skip this occurrence",
    "daily.setReminder": "Set reminder",
    "daily.skipConfirmTitle": "Skip this occurrence?",
    "daily.skipConfirmBody": "\"{title}\" will be skipped this time. The next occurrence will follow the recurrence rule.",
    "daily.skipConfirmAction": "Skip",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.errorSaving": "Couldn't save. Try again.",
  },
  "ja": {
    "settings.notifications.platformNote": "プッシュ通知は iOS アプリで受信します。Web は設定のみです。",
    "schedule.recurrence.daily": "毎日",
    "schedule.recurrence.weekly": "毎週",
    "schedule.recurrence.biweekly": "隔週",
    "schedule.recurrence.monthlyDay": "毎月特定日",
    "schedule.recurrence.monthlyNthWeekday": "毎月第N週の曜日",
    "schedule.recurrence.weekdays": "曜日",
    "schedule.recurrence.nthN": "第{n}",
    "schedule.recurrence.nthLabel": "位置",
    "schedule.recurrence.weekday": "曜日",
    "schedule.recurrence.last": "最後",
    "schedule.reminder.label": "リマインダー時刻",
    "schedule.reminder.placeholder": "通知なし",
    "schedule.reminder.clear": "クリア",
    "schedule.validation.endBeforeStart": "終了日は開始日より後にしてください。",
    "schedule.validation.weeklyNeedsWeekday": "曜日を1つ以上選択してください。",
    "schedule.recurrence.weekdayShort.sun": "日",
    "schedule.recurrence.weekdayShort.mon": "月",
    "schedule.recurrence.weekdayShort.tue": "火",
    "schedule.recurrence.weekdayShort.wed": "水",
    "schedule.recurrence.weekdayShort.thu": "木",
    "schedule.recurrence.weekdayShort.fri": "金",
    "schedule.recurrence.weekdayShort.sat": "土",
    "daily.setRecurring": "繰り返しに設定",
    "daily.skipThisOccurrence": "この回をスキップ",
    "daily.setReminder": "リマインダー設定",
    "daily.skipConfirmTitle": "この回をスキップ？",
    "daily.skipConfirmBody": "「{title}」をこの回はスキップします。次回は繰り返しルールに従います。",
    "daily.skipConfirmAction": "スキップ",
    "common.cancel": "キャンセル",
    "common.save": "保存",
    "common.errorSaving": "保存に失敗しました。もう一度お試しください。",
  },
  "zh-TW": {
    "settings.notifications.platformNote": "推播由 iOS app 接收。Web 僅做設定。",
    "schedule.recurrence.daily": "每日",
    "schedule.recurrence.weekly": "每週",
    "schedule.recurrence.biweekly": "每兩週",
    "schedule.recurrence.monthlyDay": "每月某日",
    "schedule.recurrence.monthlyNthWeekday": "每月第 N 個星期 X",
    "schedule.recurrence.weekdays": "星期",
    "schedule.recurrence.nthN": "第 {n}",
    "schedule.recurrence.nthLabel": "順位",
    "schedule.recurrence.weekday": "星期",
    "schedule.recurrence.last": "最後",
    "schedule.reminder.label": "提醒時間",
    "schedule.reminder.placeholder": "不提醒",
    "schedule.reminder.clear": "清除",
    "schedule.validation.endBeforeStart": "結束日必須晚於起始日。",
    "schedule.validation.weeklyNeedsWeekday": "至少選一個星期。",
    "schedule.recurrence.weekdayShort.sun": "日",
    "schedule.recurrence.weekdayShort.mon": "一",
    "schedule.recurrence.weekdayShort.tue": "二",
    "schedule.recurrence.weekdayShort.wed": "三",
    "schedule.recurrence.weekdayShort.thu": "四",
    "schedule.recurrence.weekdayShort.fri": "五",
    "schedule.recurrence.weekdayShort.sat": "六",
    "daily.setRecurring": "設為重複任務",
    "daily.skipThisOccurrence": "跳過這次",
    "daily.setReminder": "設提醒時間",
    "daily.skipConfirmTitle": "跳過這次發生？",
    "daily.skipConfirmBody": "「{title}」這次會被跳過。下次發生會照重複規則繼續。",
    "daily.skipConfirmAction": "跳過",
    "common.cancel": "取消",
    "common.save": "儲存",
    "common.errorSaving": "儲存失敗，請再試一次。",
  },
}
def set_nested(d, dotted, value):
    parts = dotted.split('.')
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value
for lang, path in TARGETS.items():
    with open(path) as f:
        data = json.load(f)
    added = 0
    for k, v in NEW[lang].items():
        # skip if already exists
        parts = k.split('.')
        cur = data
        exists = True
        for p in parts:
            if isinstance(cur, dict) and p in cur:
                cur = cur[p]
            else:
                exists = False
                break
        if exists:
            continue
        set_nested(data, k, v)
        added += 1
    with open(path, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f"{lang}: added {added}")
EOF
```

- [ ] **Step 2: Mirror 到 Apple xcstrings**

```bash
python3 << 'EOF'
import json
xc_path = '/Users/mike/Documents/nudge/apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings'
with open(xc_path) as f:
    data = json.load(f)
NEW = {
  "settings.notifications.platformNote": {"en": "Push notifications are delivered by the iOS app. Web is for configuration only.", "ja": "プッシュ通知は iOS アプリで受信します。Web は設定のみです。", "zh-Hant": "推播由 iOS app 接收。Web 僅做設定。"},
  "schedule.validation.endBeforeStart": {"en": "End date must be after start date.", "ja": "終了日は開始日より後にしてください。", "zh-Hant": "結束日必須晚於起始日。"},
  "schedule.validation.weeklyNeedsWeekday": {"en": "Pick at least one weekday.", "ja": "曜日を1つ以上選択してください。", "zh-Hant": "至少選一個星期。"},
  "daily.skipConfirmTitle": {"en": "Skip this occurrence?", "ja": "この回をスキップ？", "zh-Hant": "跳過這次發生？"},
  "daily.skipConfirmBody": {"en": "\"%@\" will be skipped this time. The next occurrence will follow the recurrence rule.", "ja": "「%@」をこの回はスキップします。次回は繰り返しルールに従います。", "zh-Hant": "「%@」這次會被跳過。下次發生會照重複規則繼續。"},
  "daily.skipConfirmAction": {"en": "Skip", "ja": "スキップ", "zh-Hant": "跳過"},
  "common.errorSaving": {"en": "Couldn't save. Try again.", "ja": "保存に失敗しました。もう一度お試しください。", "zh-Hant": "儲存失敗，請再試一次。"},
}
added = 0
for k, vals in NEW.items():
    if k in data['strings']: continue
    data['strings'][k] = {"localizations": {lang: {"stringUnit": {"state": "translated", "value": v}} for lang, v in vals.items()}}
    added += 1
with open(xc_path, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print(f"xcstrings: added {added}")
EOF
```

- [ ] **Step 3: Commit**

```bash
git add src/messages/ apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings
git commit -m "i18n: 補 Web 子題 #1 keys (schedule / skip / notifications)"
```

---

## Task 2: `useNotificationPreferences` hook

**Files:**
- Create: `src/lib/hooks/use-notification-preferences.ts`

- [ ] **Step 1: 建立 hook 檔**

```typescript
// src/lib/hooks/use-notification-preferences.ts
import useSWR, { mutate as globalMutate } from "swr";
import { fetcher } from "@/lib/fetcher";

export type NotificationContent = "summary" | "incomplete" | "summary_streak";

export interface NotificationPreferences {
  userId: string;
  morningEnabled: boolean;
  morningTime: string;       // "HH:MM"
  morningContent: NotificationContent;
  eveningEnabled: boolean;
  eveningTime: string;       // "HH:MM"
  eveningContent: NotificationContent;
  perTaskRemindersEnabled: boolean;
  updatedAt: string;
}

const KEY = "/api/notification-preferences";

export function useNotificationPreferences() {
  const { data, error, isLoading } = useSWR<NotificationPreferences>(
    KEY,
    fetcher,
  );

  /**
   * Patch one or more fields. Optimistically updates SWR cache then PATCHes;
   * on error, revalidates to get the canonical state back.
   */
  async function patch(updates: Partial<NotificationPreferences>) {
    if (!data) return;
    const optimistic = { ...data, ...updates };
    await globalMutate(KEY, optimistic, { revalidate: false });
    try {
      const res = await fetch(KEY, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
      const fresh = await res.json();
      await globalMutate(KEY, fresh, { revalidate: false });
    } catch (err) {
      await globalMutate(KEY); // revalidate to canonical
      throw err;
    }
  }

  return { data, error, isLoading, patch };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/hooks/use-notification-preferences.ts
git commit -m "feat(web): useNotificationPreferences hook"
```

---

## Task 3: `<NotificationsSection>` component

**Files:**
- Create: `src/components/settings/notifications-section.tsx`

- [ ] **Step 1: 建立元件檔**

```tsx
// src/components/settings/notifications-section.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useNotificationPreferences,
  type NotificationPreferences,
  type NotificationContent,
} from "@/lib/hooks/use-notification-preferences";

const CONTENTS: NotificationContent[] = ["summary", "incomplete", "summary_streak"];

export function NotificationsSection() {
  const t = useTranslations();
  const { data, patch } = useNotificationPreferences();
  const [error, setError] = useState<string | null>(null);

  if (!data) return null; // SWR loading — settings modal is short anyway

  return (
    <section className="py-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
        {t("settings.notifications.title")}
      </h3>

      <div className="space-y-3">
        <ToggleRow
          label={t("settings.notifications.morningEnabled")}
          checked={data.morningEnabled}
          onChange={(v) => save({ morningEnabled: v })}
        />
        {data.morningEnabled && (
          <>
            <TimeRow
              label={t("settings.notifications.morningTime")}
              value={data.morningTime}
              onChange={(v) => save({ morningTime: v })}
            />
            <SelectRow
              label={t("settings.notifications.morningContent")}
              value={data.morningContent}
              options={CONTENTS}
              labelFor={(v) => t(`notifications.content.${v === "summary_streak" ? "summaryStreak" : v}`)}
              onChange={(v) => save({ morningContent: v as NotificationContent })}
            />
          </>
        )}

        <ToggleRow
          label={t("settings.notifications.eveningEnabled")}
          checked={data.eveningEnabled}
          onChange={(v) => save({ eveningEnabled: v })}
        />
        {data.eveningEnabled && (
          <>
            <TimeRow
              label={t("settings.notifications.eveningTime")}
              value={data.eveningTime}
              onChange={(v) => save({ eveningTime: v })}
            />
            <SelectRow
              label={t("settings.notifications.eveningContent")}
              value={data.eveningContent}
              options={CONTENTS}
              labelFor={(v) => t(`notifications.content.${v === "summary_streak" ? "summaryStreak" : v}`)}
              onChange={(v) => save({ eveningContent: v as NotificationContent })}
            />
          </>
        )}

        <ToggleRow
          label={t("settings.notifications.perTaskEnabled")}
          checked={data.perTaskRemindersEnabled}
          onChange={(v) => save({ perTaskRemindersEnabled: v })}
        />
      </div>

      <p className="mt-4 text-xs text-text-dim">
        {t("settings.notifications.platformNote")}
      </p>
      {error && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );

  async function save(patch_: Partial<NotificationPreferences>) {
    try {
      await patch(patch_);
      setError(null);
    } catch {
      setError(t("common.errorSaving"));
    }
  }
}

function ToggleRow({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function TimeRow({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-foreground">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
        aria-label={label}
      />
    </label>
  );
}

function SelectRow<T extends string>({ label, value, options, labelFor, onChange }: {
  label: string;
  value: T;
  options: T[];
  labelFor: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
        aria-label={label}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{labelFor(opt)}</option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/notifications-section.tsx
git commit -m "feat(web): NotificationsSection component"
```

---

## Task 4: 接 NotificationsSection 到 settings-modal

**Files:**
- Modify: `src/components/settings/settings-modal.tsx`

- [ ] **Step 1: import + 插入**

在檔案 import 區加：
```typescript
import { NotificationsSection } from "./notifications-section";
```

在 `<CalendarSection />` 之後、Tags section 之前插入：
```tsx
<NotificationsSection />
```

- [ ] **Step 2: 手動驗證**

```bash
npx next dev
# 開啟 http://localhost:3000/, 點 Settings, 確認新「通知」section 顯示在 Calendar 與 Tags 之間
# 改 morningEnabled toggle, refresh, 確認儲存
```

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/settings-modal.tsx
git commit -m "feat(web): wire NotificationsSection into settings modal"
```

---

## Task 5: `useTaskRecurrence` hook

**Files:**
- Create: `src/lib/hooks/use-task-recurrence.ts`

- [ ] **Step 1: 建立 hook**

```typescript
// src/lib/hooks/use-task-recurrence.ts
import useSWR, { mutate as globalMutate } from "swr";
import { fetcher } from "@/lib/fetcher";

export type RecurrencePreset =
  | "daily"
  | "weekdays"
  | "weekly"
  | "biweekly"
  | "monthly_day"
  | "monthly_nth_weekday"
  | "yearly";

export interface TaskRecurrence {
  id: string;
  taskId: string;
  preset: RecurrencePreset;
  weekdays: string | null;       // CSV "1,3,5"
  monthDay: number | null;       // 1-31
  monthNth: number | null;       // 1-5 (5 = last)
  monthNthWeekday: number | null; // 1-7
  startDate: string;             // YYYY-MM-DD
  endDate: string | null;        // YYYY-MM-DD | null
  remindAtTimeOfDay: string | null; // HH:MM | null
  createdAt: string;
  updatedAt: string;
}

function key(taskId: string) {
  return `/api/tasks/${taskId}/recurrence`;
}

export function useTaskRecurrence(taskId: string | null) {
  const { data, error, isLoading } = useSWR<TaskRecurrence | null>(
    taskId ? key(taskId) : null,
    async (url: string) => {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GET recurrence failed: ${res.status}`);
      return res.json();
    },
  );

  /**
   * Save recurrence rule. `null` = clear (no recurrence).
   * Uses PUT (replace), not PATCH — matches backend route shape.
   */
  async function save(
    rule: Omit<TaskRecurrence, "id" | "taskId" | "createdAt" | "updatedAt"> | null,
  ) {
    if (!taskId) return;
    const url = key(taskId);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule), // null clears
      });
      if (!res.ok) throw new Error(`PUT failed: ${res.status}`);
      await globalMutate(url);
    } catch (err) {
      await globalMutate(url);
      throw err;
    }
  }

  return { data, error, isLoading, save };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/hooks/use-task-recurrence.ts
git commit -m "feat(web): useTaskRecurrence hook"
```

---

## Task 6: schedule-validation pure functions（TDD）

**Files:**
- Create: `src/lib/schedule-validation.ts`
- Create: `src/lib/schedule-validation.test.ts`

**Background:** ScheduleSection 的 form-level 檢查抽成純 function，方便單測 + UI 共用。檢查：
- `validateEndAfterStart(start: string, end: string | null): boolean`
- `validateWeeklyHasWeekday(preset: string, weekdaysCsv: string | null): boolean`
- 把 weekdays CSV 轉 Set helper

- [ ] **Step 1: 寫失敗的 test**

```typescript
// src/lib/schedule-validation.test.ts
import { describe, expect, it } from "vitest";
import {
  validateEndAfterStart,
  validateWeeklyHasWeekday,
  parseWeekdaysCsv,
  weekdaysToCsv,
} from "./schedule-validation";

describe("validateEndAfterStart", () => {
  it("end null OK", () => {
    expect(validateEndAfterStart("2026-04-26", null)).toBe(true);
  });
  it("end after start OK", () => {
    expect(validateEndAfterStart("2026-04-26", "2026-04-27")).toBe(true);
  });
  it("end equal start NOT OK", () => {
    expect(validateEndAfterStart("2026-04-26", "2026-04-26")).toBe(false);
  });
  it("end before start NOT OK", () => {
    expect(validateEndAfterStart("2026-04-26", "2026-04-25")).toBe(false);
  });
});

describe("validateWeeklyHasWeekday", () => {
  it("weekly with one weekday OK", () => {
    expect(validateWeeklyHasWeekday("weekly", "3")).toBe(true);
  });
  it("weekly with empty CSV NOT OK", () => {
    expect(validateWeeklyHasWeekday("weekly", "")).toBe(false);
    expect(validateWeeklyHasWeekday("weekly", null)).toBe(false);
  });
  it("biweekly same rule", () => {
    expect(validateWeeklyHasWeekday("biweekly", "1,5")).toBe(true);
    expect(validateWeeklyHasWeekday("biweekly", null)).toBe(false);
  });
  it("non-weekly preset always OK", () => {
    expect(validateWeeklyHasWeekday("daily", null)).toBe(true);
    expect(validateWeeklyHasWeekday("monthly_day", null)).toBe(true);
  });
});

describe("parseWeekdaysCsv / weekdaysToCsv", () => {
  it("round-trips set", () => {
    expect(parseWeekdaysCsv("1,3,5")).toEqual(new Set([1, 3, 5]));
    expect(weekdaysToCsv(new Set([5, 1, 3]))).toBe("1,3,5");
  });
  it("empty handles", () => {
    expect(parseWeekdaysCsv(null)).toEqual(new Set());
    expect(parseWeekdaysCsv("")).toEqual(new Set());
    expect(weekdaysToCsv(new Set())).toBe("");
  });
  it("ignores invalid", () => {
    expect(parseWeekdaysCsv("0,3,8,abc")).toEqual(new Set([3]));
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
cd /Users/mike/Documents/nudge && npx vitest run src/lib/schedule-validation.test.ts
```
Expected: FAIL — Cannot find module './schedule-validation'

- [ ] **Step 3: 寫 minimal impl**

```typescript
// src/lib/schedule-validation.ts
/**
 * 結束日必須晚於起始日（不可同日）。null 表示不設結束 → 永遠有效。
 * 字串 "YYYY-MM-DD" 比對直接用字串比即可（lexicographic == chronological）。
 */
export function validateEndAfterStart(start: string, end: string | null): boolean {
  if (end === null) return true;
  return end > start;
}

/**
 * 每週 / 每兩週 必須至少選一個 weekday。其他 preset 不檢查。
 */
export function validateWeeklyHasWeekday(
  preset: string,
  weekdaysCsv: string | null,
): boolean {
  if (preset !== "weekly" && preset !== "biweekly") return true;
  const set = parseWeekdaysCsv(weekdaysCsv);
  return set.size > 0;
}

/** ISO weekday 1=Mon..7=Sun。Skip 非 1-7 整數。 */
export function parseWeekdaysCsv(csv: string | null): Set<number> {
  if (!csv) return new Set();
  return new Set(
    csv.split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7),
  );
}

export function weekdaysToCsv(set: Set<number>): string {
  return [...set].sort((a, b) => a - b).join(",");
}
```

- [ ] **Step 4: Run test, expect PASS**

```bash
npx vitest run src/lib/schedule-validation.test.ts
```
Expected: 4 describe blocks, all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule-validation.ts src/lib/schedule-validation.test.ts
git commit -m "feat(web): schedule-validation pure functions + tests"
```

---

## Task 7: `<ScheduleSection>` component

**Files:**
- Create: `src/components/task/schedule-section.tsx`

**Background:** Recurrence picker + 條件式欄位 + 起始/結束日 + 提醒時間。儲存呼叫 `useTaskRecurrence().save()`，`remindAtTimeOfDay` 是 recurrence 的一部分（不另外打 card.remindAt — 對齊 Apple ScheduleSection 寫法）。

- [ ] **Step 1: 建立元件**

```tsx
// src/components/task/schedule-section.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useTaskRecurrence,
  type RecurrencePreset,
} from "@/lib/hooks/use-task-recurrence";
import {
  validateEndAfterStart,
  validateWeeklyHasWeekday,
  parseWeekdaysCsv,
  weekdaysToCsv,
} from "@/lib/schedule-validation";

const PRESETS: (RecurrencePreset | null)[] = [
  null, "daily", "weekly", "biweekly", "monthly_day", "monthly_nth_weekday",
];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const; // ISO Mon..Sun
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

interface Props {
  taskId: string;
}

export function ScheduleSection({ taskId }: Props) {
  const t = useTranslations();
  const { data, save } = useTaskRecurrence(taskId);

  const [preset, setPreset] = useState<RecurrencePreset | null>(null);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [monthNth, setMonthNth] = useState(1);
  const [monthNthWeekday, setMonthNthWeekday] = useState(1);
  const [startDate, setStartDate] = useState(today());
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState(today());
  const [remindAt, setRemindAt] = useState<string>(""); // "" = 不提醒

  // Sync from server
  useEffect(() => {
    if (data) {
      setPreset(data.preset);
      setWeekdays(parseWeekdaysCsv(data.weekdays));
      setMonthNth(data.monthNth ?? 1);
      setMonthNthWeekday(data.monthNthWeekday ?? 1);
      setStartDate(data.startDate);
      setHasEndDate(data.endDate !== null);
      setEndDate(data.endDate ?? today());
      setRemindAt(data.remindAtTimeOfDay ?? "");
    }
  }, [data]);

  const errEnd = !validateEndAfterStart(startDate, hasEndDate ? endDate : null);
  const errWeekday = !validateWeeklyHasWeekday(
    preset ?? "",
    weekdaysToCsv(weekdays),
  );
  const isValid = !errEnd && !errWeekday;

  // Debounced save (500ms) — single timer for any field change
  useEffect(() => {
    if (!data && preset === null) return; // 初始 mount，沒值不存
    if (!isValid) return;
    const t = setTimeout(() => {
      doSave();
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, weekdays, monthNth, monthNthWeekday, startDate, hasEndDate, endDate, remindAt]);

  async function doSave() {
    if (preset === null) {
      await save(null);
      return;
    }
    const monthDay = preset === "monthly_day"
      ? new Date(startDate + "T00:00").getDate()
      : null;
    await save({
      preset,
      weekdays: (preset === "weekly" || preset === "biweekly")
        ? weekdaysToCsv(weekdays)
        : null,
      monthDay,
      monthNth: preset === "monthly_nth_weekday" ? monthNth : null,
      monthNthWeekday: preset === "monthly_nth_weekday" ? monthNthWeekday : null,
      startDate,
      endDate: hasEndDate ? endDate : null,
      remindAtTimeOfDay: remindAt || null,
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="block text-sm font-medium text-foreground">
          {t("schedule.recurrenceTitle")}
        </label>
        <select
          value={preset ?? ""}
          onChange={(e) => setPreset((e.target.value || null) as RecurrencePreset | null)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          {PRESETS.map((p) => (
            <option key={p ?? "off"} value={p ?? ""}>
              {t(`schedule.recurrence.${p ?? "off"}`)}
            </option>
          ))}
        </select>

        {(preset === "weekly" || preset === "biweekly") && (
          <div>
            <label className="text-xs text-text-dim">{t("schedule.recurrence.weekdays")}</label>
            <div className="mt-1 flex gap-1">
              {WEEKDAYS.map((d, i) => {
                const active = weekdays.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      const next = new Set(weekdays);
                      if (active) next.delete(d); else next.add(d);
                      setWeekdays(next);
                    }}
                    className={`h-8 w-8 rounded-full text-xs font-medium ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {t(`schedule.recurrence.weekdayShort.${WEEKDAY_KEYS[i]}`)}
                  </button>
                );
              })}
            </div>
            {errWeekday && (
              <p className="mt-1 text-xs text-destructive">
                {t("schedule.validation.weeklyNeedsWeekday")}
              </p>
            )}
          </div>
        )}

        {preset === "monthly_day" && (
          <p className="text-sm text-text-dim">
            {t("schedule.recurrence.monthDayN", { n: new Date(startDate + "T00:00").getDate() })}
          </p>
        )}

        {preset === "monthly_nth_weekday" && (
          <div className="flex gap-2">
            <select
              value={monthNth}
              onChange={(e) => setMonthNth(parseInt(e.target.value, 10))}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              aria-label={t("schedule.recurrence.nthLabel")}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{t("schedule.recurrence.nthN", { n })}</option>
              ))}
              <option value={5}>{t("schedule.recurrence.last")}</option>
            </select>
            <select
              value={monthNthWeekday}
              onChange={(e) => setMonthNthWeekday(parseInt(e.target.value, 10))}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              aria-label={t("schedule.recurrence.weekday")}
            >
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={d}>
                  {t(`schedule.recurrence.weekdayShort.${WEEKDAY_KEYS[i]}`)}
                </option>
              ))}
            </select>
          </div>
        )}

        {preset !== null && (
          <>
            <DateRow
              label={t("schedule.recurrence.startDate")}
              value={startDate}
              onChange={setStartDate}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasEndDate}
                onChange={(e) => setHasEndDate(e.target.checked)}
              />
              {t("schedule.recurrence.hasEndDate")}
            </label>
            {hasEndDate && (
              <>
                <DateRow
                  label={t("schedule.recurrence.endDate")}
                  value={endDate}
                  onChange={setEndDate}
                />
                {errEnd && (
                  <p className="text-xs text-destructive">
                    {t("schedule.validation.endBeforeStart")}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="space-y-1 border-t border-border pt-4">
        <label className="block text-sm font-medium text-foreground">
          {t("schedule.reminder.label")}
        </label>
        <div className="flex gap-2">
          <input
            type="time"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            aria-label={t("schedule.reminder.label")}
          />
          {remindAt && (
            <button
              type="button"
              onClick={() => setRemindAt("")}
              className="text-xs text-text-dim hover:text-foreground"
            >
              {t("schedule.reminder.clear")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DateRow({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-foreground">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1"
        aria-label={label}
      />
    </label>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/task/schedule-section.tsx
git commit -m "feat(web): ScheduleSection component (recurrence + reminder)"
```

---

## Task 8: 接 ScheduleSection 到 card-detail

**Files:**
- Modify: `src/components/cards/card-detail.tsx`

- [ ] **Step 1: import + 插入**

import 區加：
```typescript
import { ScheduleSection } from "@/components/task/schedule-section";
```

在 footer（TagPicker 與 metadata 之間）插入：
```tsx
<div className="border-t border-border pt-4">
  <ScheduleSection taskId={card.id} />
</div>
```

- [ ] **Step 2: 手動驗證**

```bash
npx next dev
# 開卡片 detail，捲到底，確認 ScheduleSection 顯示
# 改 preset → weekly，選 1-2 個 weekday，等 500ms 後重整，確認儲存
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/card-detail.tsx
git commit -m "feat(web): wire ScheduleSection into card detail"
```

---

## Task 9: `<ScheduleDialog>` 包裝

**Files:**
- Create: `src/components/task/schedule-dialog.tsx`

- [ ] **Step 1: 建立 dialog wrapper**

```tsx
// src/components/task/schedule-dialog.tsx
"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScheduleSection } from "./schedule-section";

interface Props {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleDialog({ taskId, open, onOpenChange }: Props) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {t("schedule.recurrenceTitle")}
          </DialogTitle>
        </DialogHeader>
        {taskId && <ScheduleSection taskId={taskId} />}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/task/schedule-dialog.tsx
git commit -m "feat(web): ScheduleDialog wrapper"
```

---

## Task 10: `<SkipConfirmationDialog>`

**Files:**
- Create: `src/components/task/skip-confirmation-dialog.tsx`

- [ ] **Step 1: 建立 confirmation dialog**

```tsx
// src/components/task/skip-confirmation-dialog.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { mutate as globalMutate } from "swr";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  assignmentId: string | null;
  taskTitle: string;
  currentDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkipConfirmationDialog({
  assignmentId, taskTitle, currentDate, open, onOpenChange,
}: Props) {
  const t = useTranslations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSkip() {
    if (!assignmentId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/daily-assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSkipped: true }),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
      await globalMutate(`/api/daily/${currentDate}`);
      onOpenChange(false);
    } catch (err) {
      console.error("[SkipConfirmationDialog] failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("daily.skipConfirmTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground">
          {t("daily.skipConfirmBody", { title: taskTitle })}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {t("daily.skipConfirmAction")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/task/skip-confirmation-dialog.tsx
git commit -m "feat(web): SkipConfirmationDialog"
```

---

## Task 11: 在 task-card 加 DropdownMenu + 右鍵 menu

**Files:**
- Modify: `src/components/task/task-card.tsx`

**Background:** 既有 task-card.tsx 沒有 dropdown menu。要加：
1. 一顆 `…` 按鈕（在 FileText 旁），點開 DropdownMenu
2. row 的 `onContextMenu` 也開同一個 menu（用同樣 state）
3. menu 裡 3 個項目：「設為重複任務 / 跳過這次 / 設提醒時間」（前兩個依 isRecurring 互斥顯示）
4. menu items 觸發 `<ScheduleDialog>` 或 `<SkipConfirmationDialog>` 開啟

判斷 `isRecurring` 用 `assignment.task.recurrence != null`（assignment 來自 daily endpoint，已包含 recurrence）。如果型別沒有 recurrence field，看 step 3 補。

- [ ] **Step 1: 確認 DailyTaskAssignment 型別有 recurrence**

```bash
grep -A5 "DailyTaskAssignment\b" src/lib/types.ts
```

如果沒有 `recurrence` field，加：
```typescript
// src/lib/types.ts (extend the existing interface)
recurrence?: { preset: string } | null;
```

- [ ] **Step 2: 改 task-card.tsx — 加 imports + state + handlers**

在檔案頂端 imports 加：
```typescript
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ScheduleDialog } from "./schedule-dialog";
import { SkipConfirmationDialog } from "./skip-confirmation-dialog";
```

在 `TaskCard` body 內、現有 useState 之後加：
```typescript
const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
const [skipDialogOpen, setSkipDialogOpen] = useState(false);
const [contextMenuOpen, setContextMenuOpen] = useState(false);
const isRecurring = assignment.task.recurrence != null;
```

- [ ] **Step 3: 加「…」按鈕（DropdownMenu）**

在 `FileText` 按鈕之後加：

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button
      type="button"
      aria-label={t("rowMenu")}
      className="rounded p-1 text-text-dim hover:text-foreground"
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    {isRecurring ? (
      <DropdownMenuItem onClick={() => setSkipDialogOpen(true)}>
        {t("skipThisOccurrence")}
      </DropdownMenuItem>
    ) : (
      <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
        {t("setRecurring")}
      </DropdownMenuItem>
    )}
    <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
      {t("setReminder")}
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

註：`task` namespace 應已有 `rowMenu`、`skipThisOccurrence`、`setRecurring`、`setReminder` keys（task 1 已加）。如果 useTranslations namespace 不對，把 `t("...")` 換成 `t("daily.skipThisOccurrence")` 等完整路徑。

- [ ] **Step 4: 加右鍵 context menu**

在 row 最外層 div 加 `onContextMenu`：

```tsx
<div
  // ...existing props
  onContextMenu={(e) => {
    e.preventDefault();
    setContextMenuOpen(true);
  }}
>
```

context menu 用同一個 DropdownMenuContent 但用 controlled mode：

```tsx
<DropdownMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
  <DropdownMenuContent>
    {/* 同上三個 items */}
  </DropdownMenuContent>
</DropdownMenu>
```

如果 base-ui 的 menu 不支援 controlled-without-trigger 模式，改用一個 hidden trigger 或 popover anchor。實作時參考 `src/components/ui/dropdown-menu.tsx` 的 props。

- [ ] **Step 5: 掛上 dialog 元件**

在 component return 結尾加：

```tsx
<ScheduleDialog
  taskId={scheduleDialogOpen ? task.id : null}
  open={scheduleDialogOpen}
  onOpenChange={setScheduleDialogOpen}
/>
<SkipConfirmationDialog
  assignmentId={skipDialogOpen ? assignment.id : null}
  taskTitle={task.title}
  currentDate={currentDate}
  open={skipDialogOpen}
  onOpenChange={setSkipDialogOpen}
/>
```

- [ ] **Step 6: 手動驗證**

```bash
npx next dev
# 1. 點任務的 …  → 看到 menu 三項
# 2. 「設為重複任務」→ ScheduleDialog 開啟，設 weekly + 一個 weekday，500ms 後關 dialog 重整任務還在 daily
# 3. 右鍵任務 → 同樣 menu 出現
# 4. 改 preset 後刷新，… menu 變「跳過這次」
# 5. 「跳過這次」→ confirm dialog → 點跳過 → row 從畫面消失
```

- [ ] **Step 7: Commit**

```bash
git add src/components/task/task-card.tsx src/lib/types.ts
git commit -m "feat(web): task row schedule actions (… menu + 右鍵 menu + dialogs)"
```

---

## Self-review checklist

跑完所有 task 後再做一遍：

- [ ] 開 Settings 看到「通知」section，所有欄位可改，refresh 後保留
- [ ] 卡片 detail 底部看到 ScheduleSection，preset 切換條件式欄位顯隱對
- [ ] weekly + 0 weekday → 跳紅字 + 不存
- [ ] hasEndDate + endDate ≤ startDate → 跳紅字 + 不存
- [ ] task row 「…」與右鍵 都能開 menu，3 項都能開對應 dialog
- [ ] 「跳過這次」confirm 後 row 消失，下次發生（隔週）仍出現
- [ ] 三語言（en / ja / zh-TW）都看得到正確翻譯
- [ ] vitest schedule-validation 11 個 test 全綠
- [ ] `npx next build` 無 type error

---

## Spec coverage check

| Spec section | Tasks |
|---|---|
| Surface 1: Settings notifications section | 1, 2, 3, 4 |
| Surface 2: Card detail ScheduleSection | 1, 5, 6, 7, 8 |
| Surface 3: Daily row schedule actions | 1, 9, 10, 11 |
| Validation rules | 6 |
| i18n | 1 |
| Edge cases (revalidate, optimistic, errors) | 2, 5, 9, 10 (各 hook / dialog 處理) |
| Testing (unit) | 6 (schedule-validation) |
| Testing (component / E2E) | Self-review 手動 |

無未涵蓋。

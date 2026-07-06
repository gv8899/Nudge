// 純函式：把 locale-neutral 的 OnboardingContent 解析成「可直接寫入 DB 的
// 具體 row 集合」（日期、提醒時間、重複規則都算好）。無 I/O、無 Date.now()、
// 無 random —— id 由 writer 指派 —— 因此可完整單元測試。

import type { OnboardingContent } from "./content/types";

export type SeedRecurrence = {
  preset: "weekly" | "weekdays";
  weekdays: string | null; // CSV "1,2,3,4,5"
  startDate: string; // YYYY-MM-DD（一律今天）
  remindAtTimeOfDay: string | null; // "HH:MM" or null
};

export type SeedTaskRow = {
  key: string;
  title: string;
  description: string | null; // 非 null 即為「卡片」
  status: "done" | "inbox";
  createdAt: string; // ISO
  remindAt: string | null; // ISO or null
  sortOrder: number;
  /** 有指派才排進某天（卡片沒有）。 */
  assignment: { date: string; isCompleted: boolean } | null;
  recurrence: SeedRecurrence | null;
  tagKey: string | null;
};

export type SeedTagRow = { key: string; name: string; color: string; sortOrder: number };
export type SeedNoteRow = { date: string; content: string; sortOrder: number };

export type SeedPlan = {
  today: string;
  tags: SeedTagRow[];
  tasks: SeedTaskRow[]; // 一般任務 + 卡片，統一成 task row
  notes: SeedNoteRow[];
};

// ── 日期工具（tz-aware，純計算）──

/** base 這個時間點在 tz 底下的日曆日 YYYY-MM-DD。 */
function todayYmdInTz(base: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(base);
    const y = parts.find((p) => p.type === "year")!.value;
    const m = parts.find((p) => p.type === "month")!.value;
    const d = parts.find((p) => p.type === "day")!.value;
    return `${y}-${m}-${d}`;
  } catch {
    return base.toISOString().slice(0, 10);
  }
}

/** 用純日曆數學把 YYYY-MM-DD 位移 n 天（走 UTC 避免 DST / tz 干擾）。 */
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function recurrenceRule(
  kind: "weekly_fri" | "weekdays",
  today: string,
): SeedRecurrence {
  if (kind === "weekly_fri") {
    return { preset: "weekly", weekdays: "5", startDate: today, remindAtTimeOfDay: "17:00" };
  }
  return { preset: "weekdays", weekdays: "1,2,3,4,5", startDate: today, remindAtTimeOfDay: null };
}

/**
 * 解析範例內容為具體 SeedPlan。
 * @param content 某 locale 的範例內容
 * @param now     基準時間點（測試注入固定值）
 * @param tz      使用者時區（用來決定「今天」）
 */
export function buildOnboardingSeed(
  content: OnboardingContent,
  now: Date,
  tz: string,
): SeedPlan {
  const today = todayYmdInTz(now, tz);

  const tags: SeedTagRow[] = content.tags.map((t, i) => ({
    key: t.key,
    name: t.name,
    color: t.color,
    sortOrder: i,
  }));

  let sortOrder = 0;
  const tasks: SeedTaskRow[] = [];

  // 一般任務（今日 + 逾期）
  content.tasks.forEach((t) => {
    const assignDate = addDays(today, t.dayOffset);
    const remindAt = t.remindAtTimeOfDay ? `${assignDate}T${t.remindAtTimeOfDay}:00` : null;
    tasks.push({
      key: t.key,
      title: t.title,
      description: null,
      status: t.done ? "done" : "inbox",
      createdAt: now.toISOString(),
      remindAt,
      sortOrder: sortOrder++,
      assignment: { date: assignDate, isCompleted: !!t.done },
      recurrence: t.recurrence ? recurrenceRule(t.recurrence, today) : null,
      tagKey: null,
    });
  });

  // 卡片（有內容的任務，不指派到某天）
  content.cards.forEach((c) => {
    const createdAt = new Date(now.getTime() + c.createdOffset * 86400000).toISOString();
    tasks.push({
      key: c.key,
      title: c.title,
      description: c.html,
      status: "inbox",
      createdAt,
      remindAt: null,
      sortOrder: sortOrder++,
      assignment: null,
      recurrence: null,
      tagKey: c.tagKey ?? null,
    });
  });

  const notes: SeedNoteRow[] = content.notes.map((n, i) => ({
    date: addDays(today, n.dayOffset),
    content: n.lines.join("\n\n"),
    sortOrder: i,
  }));

  return { today, tags, tasks, notes };
}

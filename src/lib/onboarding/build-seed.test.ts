import { describe, it, expect } from "vitest";
import { buildOnboardingSeed } from "./build-seed";
import { contentForLocale, ANCHOR_KEYS } from "./content";
import { zhTW } from "./content/zh-TW";
import { en } from "./content/en";
import { ja } from "./content/ja";

// 固定基準：2026-07-07 04:00 UTC = 台北時間 2026-07-07 12:00 → 今天 = 2026-07-07
const NOW = new Date("2026-07-07T04:00:00Z");
const TZ = "Asia/Taipei";

describe("buildOnboardingSeed", () => {
  const plan = buildOnboardingSeed(zhTW, NOW, TZ);

  it("today reflects the tz", () => {
    expect(plan.today).toBe("2026-07-07");
  });

  it("row counts match content (tasks + cards unified)", () => {
    expect(plan.tags).toHaveLength(zhTW.tags.length);
    expect(plan.tasks).toHaveLength(zhTW.tasks.length + zhTW.cards.length);
    expect(plan.notes).toHaveLength(zhTW.notes.length);
  });

  it("overdue task (dayOffset -3) assigns to today-3", () => {
    const t = plan.tasks.find((r) => r.key === "reply-client")!;
    expect(t.assignment?.date).toBe("2026-07-04");
  });

  it("overdue task (dayOffset -5) assigns to today-5", () => {
    const t = plan.tasks.find((r) => r.key === "pay-bills")!;
    expect(t.assignment?.date).toBe("2026-07-02");
  });

  it("recurrence rules all start today", () => {
    const recurring = plan.tasks.filter((r) => r.recurrence);
    expect(recurring.length).toBeGreaterThan(0);
    for (const r of recurring) expect(r.recurrence!.startDate).toBe("2026-07-07");
  });

  it("never creates an assignment in the future", () => {
    for (const r of plan.tasks) {
      if (r.assignment) expect(r.assignment.date <= plan.today).toBe(true);
    }
  });

  it("weekly_fri task carries the 17:00 reminder", () => {
    const t = plan.tasks.find((r) => r.key === "weekly-report")!;
    expect(t.recurrence!.preset).toBe("weekly");
    expect(t.recurrence!.weekdays).toBe("5");
    expect(t.recurrence!.remindAtTimeOfDay).toBe("17:00");
    expect(t.remindAt).toBe("2026-07-07T17:00:00");
  });

  it("weekdays task has no reminder", () => {
    const t = plan.tasks.find((r) => r.key === "standup")!;
    expect(t.recurrence!.preset).toBe("weekdays");
    expect(t.recurrence!.weekdays).toBe("1,2,3,4,5");
    expect(t.recurrence!.remindAtTimeOfDay).toBeNull();
  });

  it("done task becomes done + completed assignment", () => {
    const t = plan.tasks.find((r) => r.key === "morning-exercise")!;
    expect(t.status).toBe("done");
    expect(t.assignment?.isCompleted).toBe(true);
  });

  it("cards carry html description and no assignment", () => {
    const card = plan.tasks.find((r) => r.key === ANCHOR_KEYS.card)!;
    expect(card.description).toContain("<");
    expect(card.assignment).toBeNull();
  });
});

describe("contentForLocale", () => {
  it("falls back to zh-TW for null/unknown", () => {
    expect(contentForLocale(null)).toBe(zhTW);
    expect(contentForLocale("de")).toBe(zhTW);
    expect(contentForLocale("zh")).toBe(zhTW);
  });
  it("maps en/ja incl. region subtags", () => {
    expect(contentForLocale("en")).toBe(en);
    expect(contentForLocale("en-US")).toBe(en);
    expect(contentForLocale("ja")).toBe(ja);
  });
});

describe("content parity across locales", () => {
  const locales = { zhTW, en, ja };
  const keysOf = (c: typeof zhTW) => ({
    tags: c.tags.map((t) => t.key),
    tasks: c.tasks.map((t) => t.key),
    cards: c.cards.map((t) => t.key),
    notes: c.notes.map((t) => t.key),
  });
  const base = keysOf(zhTW);
  for (const [name, c] of Object.entries(locales)) {
    it(`${name} has identical keys/structure to zh-TW`, () => {
      expect(keysOf(c)).toEqual(base);
      // recurrence / dayOffset / done 等結構性欄位也須一致（只有文字可不同）
      c.tasks.forEach((t, i) => {
        expect(t.dayOffset).toBe(zhTW.tasks[i].dayOffset);
        expect(t.recurrence).toBe(zhTW.tasks[i].recurrence);
        expect(!!t.done).toBe(!!zhTW.tasks[i].done);
      });
      c.cards.forEach((cd, i) => {
        expect(cd.createdOffset).toBe(zhTW.cards[i].createdOffset);
        expect(cd.tagKey).toBe(zhTW.cards[i].tagKey);
      });
    });
  }
});

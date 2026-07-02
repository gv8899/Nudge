import { describe, it, expect } from "vitest";
import { composeRemindAtISO, splitRemindAtISO } from "./reminder-time";

describe("reminder-time", () => {
  it("compose → split round-trips（local）", () => {
    const iso = composeRemindAtISO("2026-07-15", "09:30");
    const { date, time } = splitRemindAtISO(iso);
    expect(date).toBe("2026-07-15");
    expect(time).toBe("09:30");
  });

  it("compose 輸出合法 ISO（可被 Date parse）", () => {
    const iso = composeRemindAtISO("2026-01-02", "23:05");
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
    expect(iso.endsWith("Z")).toBe(true);
  });
});

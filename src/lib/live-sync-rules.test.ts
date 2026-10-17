import { describe, it, expect } from "vitest";
import { decideRemoteChange, sameSecond } from "./live-sync-rules";

const base = "2026-10-17T10:00:00.000Z";
const newer = "2026-10-17T10:00:05.000Z";
const sameSecLater = "2026-10-17T10:00:00.900Z";

describe("decideRemoteChange", () => {
  it("別張卡的 task 事件 → list-only", () => {
    expect(decideRemoteChange({ event: { kind: "task", id: "other", updatedAt: newer }, cardId: "c1", baseUpdatedAt: base, hasPending: false })).toBe("list-only");
  });
  it("kind any → list-only", () => {
    expect(decideRemoteChange({ event: { kind: "any" }, cardId: "c1", baseUpdatedAt: base, hasPending: false })).toBe("list-only");
  });
  it("同卡、較新、沒有 pending → apply", () => {
    expect(decideRemoteChange({ event: { kind: "task", id: "c1", updatedAt: newer }, cardId: "c1", baseUpdatedAt: base, hasPending: false })).toBe("apply");
  });
  it("同卡、同一秒（自己的回音）→ ignore", () => {
    expect(decideRemoteChange({ event: { kind: "task", id: "c1", updatedAt: sameSecLater }, cardId: "c1", baseUpdatedAt: base, hasPending: false })).toBe("ignore");
  });
  it("同卡、較舊 → ignore", () => {
    expect(decideRemoteChange({ event: { kind: "task", id: "c1", updatedAt: base }, cardId: "c1", baseUpdatedAt: newer, hasPending: false })).toBe("ignore");
  });
  it("同卡、較新、但有 pending → ignore（交給 409 路徑）", () => {
    expect(decideRemoteChange({ event: { kind: "task", id: "c1", updatedAt: newer }, cardId: "c1", baseUpdatedAt: base, hasPending: true })).toBe("ignore");
  });
  it("沒有 base（還沒 seed）→ apply", () => {
    expect(decideRemoteChange({ event: { kind: "task", id: "c1", updatedAt: newer }, cardId: "c1", baseUpdatedAt: null, hasPending: false })).toBe("apply");
  });
});

describe("sameSecond", () => {
  it("秒精度", () => {
    expect(sameSecond(base, sameSecLater)).toBe(true);
    expect(sameSecond(base, newer)).toBe(false);
  });
});

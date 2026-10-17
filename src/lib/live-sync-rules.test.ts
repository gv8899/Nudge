import { describe, it, expect } from "vitest";
import { decideRemoteChange, decideOnDataChange, sameSecond, shouldRemountAfterFetch } from "./live-sync-rules";

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

describe("shouldRemountAfterFetch", () => {
  const mounted = { title: "T", description: "<p>old</p>" };
  it("latest undefined → false", () => {
    expect(shouldRemountAfterFetch({ mounted, latest: undefined, stillIdle: true })).toBe(false);
  });
  it("不再閒置 → false", () => {
    expect(shouldRemountAfterFetch({ mounted, latest: { title: "T", description: "<p>new</p>" }, stillIdle: false })).toBe(false);
  });
  it("內容與掛載的相同 → false", () => {
    expect(shouldRemountAfterFetch({ mounted, latest: { title: "T", description: "<p>old</p>" }, stillIdle: true })).toBe(false);
  });
  it("內容與掛載的不同 → true（即使 SWR cache 早已是新內容）", () => {
    expect(shouldRemountAfterFetch({ mounted, latest: { title: "T", description: "<p>new</p>" }, stillIdle: true })).toBe(true);
    expect(shouldRemountAfterFetch({ mounted, latest: { title: "T2", description: "<p>old</p>" }, stillIdle: true })).toBe(true);
  });
});

describe("decideOnDataChange", () => {
  const mounted = { title: "T", description: "<p>old</p>" };
  it("本機 pending → skip（不 seed、不重 mount；即使是第一次或內容不同）", () => {
    expect(decideOnDataChange({ first: false, pending: true, mounted, latest: { title: "T", description: "<p>new</p>" } })).toBe("skip");
    expect(decideOnDataChange({ first: true, pending: true, mounted, latest: mounted })).toBe("skip");
  });
  it("第一次拿到這張卡 → seed-first", () => {
    expect(decideOnDataChange({ first: true, pending: false, mounted: { title: "", description: "" }, latest: mounted })).toBe("seed-first");
  });
  it("idle、內容與掛載的不同 → remount-and-seed", () => {
    expect(decideOnDataChange({ first: false, pending: false, mounted, latest: { title: "T", description: "<p>new</p>" } })).toBe("remount-and-seed");
  });
  it("idle、內容與掛載的相同 → seed", () => {
    expect(decideOnDataChange({ first: false, pending: false, mounted, latest: { title: "T", description: "<p>old</p>" } })).toBe("seed");
  });
});

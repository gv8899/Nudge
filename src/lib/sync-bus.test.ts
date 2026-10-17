import { describe, it, expect } from "vitest";
import { parseNotifyPayload, SubscriberRegistry, getRegistry } from "./sync-bus";

describe("parseNotifyPayload", () => {
  it("task 事件", () => {
    expect(
      parseNotifyPayload('{"userId":"u1","kind":"task","id":"t1","updatedAt":"2026-10-17T00:00:00.000Z"}'),
    ).toEqual({ userId: "u1", kind: "task", id: "t1", updatedAt: "2026-10-17T00:00:00.000Z" });
  });
  it("any 事件", () => {
    expect(parseNotifyPayload('{"userId":"u1","kind":"any"}')).toEqual({ userId: "u1", kind: "any" });
  });
  it("壞 JSON / 缺欄位 / 未知 kind → null，不丟例外", () => {
    expect(parseNotifyPayload("{")).toBeNull();
    expect(parseNotifyPayload('{"kind":"task","id":"t1","updatedAt":"x"}')).toBeNull();
    expect(parseNotifyPayload('{"userId":"u1","kind":"task"}')).toBeNull();
    expect(parseNotifyPayload('{"userId":"u1","kind":"note"}')).toBeNull();
  });
});

describe("SubscriberRegistry", () => {
  it("只送給同 user，unsubscribe 後不再送", () => {
    const r = new SubscriberRegistry();
    const got: string[] = [];
    const off = r.subscribe("u1", (e) => got.push("a:" + e.kind));
    r.subscribe("u2", (e) => got.push("b:" + e.kind));
    expect(r.emit("u1", { kind: "any" })).toBe(1);
    off();
    expect(r.emit("u1", { kind: "any" })).toBe(0);
    expect(r.count("u1")).toBe(0);
    expect(got).toEqual(["a:any"]);
  });
  it("某個 send 丟例外不影響其他訂閱者", () => {
    const r = new SubscriberRegistry();
    const got: string[] = [];
    r.subscribe("u1", () => { throw new Error("boom"); });
    r.subscribe("u1", (e) => got.push(e.kind));
    expect(r.emit("u1", { kind: "any" })).toBe(1);
    expect(got).toEqual(["any"]);
  });
  it("getRegistry 是 process 單例", () => {
    expect(getRegistry()).toBe(getRegistry());
  });
});

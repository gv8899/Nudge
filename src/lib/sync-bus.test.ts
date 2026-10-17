import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

const fakes = vi.hoisted(() => ({ clients: [] as unknown[], connectImpl: null as null | (() => Promise<void>) }));
vi.mock("pg", async () => {
  const { EventEmitter } = await import("node:events");
  class Client extends EventEmitter {
    connect = vi.fn(() => (fakes.connectImpl ? fakes.connectImpl() : Promise.resolve()));
    query = vi.fn(() => Promise.resolve());
    end = vi.fn(() => Promise.resolve());
    constructor() {
      super();
      fakes.clients.push(this);
    }
  }
  return { Client };
});
vi.mock("@/lib/db", () => ({ db: { execute: vi.fn() } }));
import { parseNotifyPayload, SubscriberRegistry, getRegistry, ensureListener } from "./sync-bus";

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
  it("unsubscribe 重複呼叫不會刪掉較新的訂閱者", () => {
    const r = new SubscriberRegistry();
    const got: string[] = [];
    const offA = r.subscribe("u1", () => {});
    offA();
    r.subscribe("u1", (e) => got.push(e.kind));
    offA();
    expect(r.emit("u1", { kind: "any" })).toBe(1);
    expect(got).toEqual(["any"]);
  });
  it("closeAll：每個 onClose 呼叫一次、清空 registry，onClose 丟例外不影響其他人", () => {
    const r = new SubscriberRegistry();
    const closed: string[] = [];
    r.subscribe("u1", () => {}, () => closed.push("a"));
    r.subscribe("u1", () => {}, () => { closed.push("b"); throw new Error("boom"); });
    r.subscribe("u2", () => {}, () => closed.push("c"));
    r.subscribe("u2", () => {}); // 沒給 onClose 也行
    expect(r.closeAll()).toBe(4);
    expect(closed.sort()).toEqual(["a", "b", "c"]);
    expect(r.count("u1")).toBe(0);
    expect(r.count("u2")).toBe(0);
    expect(r.emit("u1", { kind: "any" })).toBe(0);
    expect(r.closeAll()).toBe(0);
    expect(closed).toHaveLength(3);
  });
  it("getRegistry 是 process 單例", () => {
    expect(getRegistry()).toBe(getRegistry());
  });
});

describe("ensureListener", () => {
  type Fake = EventEmitter & { connect: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  const g = globalThis as unknown as { __nudgeSyncListener?: unknown };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fakes.clients.length = 0;
    fakes.connectImpl = null;
    g.__nudgeSyncListener = undefined;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("連線後 error：RECONNECT_MIN_MS 後才重連，且 error 觸發兩次也只建一個新 client", async () => {
    ensureListener();
    await vi.advanceTimersByTimeAsync(0);
    expect(fakes.clients).toHaveLength(1);
    const c = fakes.clients[0] as Fake;
    c.emit("error", new Error("x"));
    c.emit("error", new Error("y"));
    await vi.advanceTimersByTimeAsync(999);
    expect(fakes.clients).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fakes.clients).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fakes.clients).toHaveLength(2);
  });

  it("error / notification handler 在 connect() resolve 之前就已註冊", async () => {
    let listenersAtConnect = { error: 0, notification: 0 };
    fakes.connectImpl = async () => {
      const c = fakes.clients[0] as Fake;
      listenersAtConnect = { error: c.listenerCount("error"), notification: c.listenerCount("notification") };
      c.emit("error", new Error("socket died mid-connect")); // 不可 uncaught
      throw new Error("connect failed");
    };
    ensureListener();
    await vi.advanceTimersByTimeAsync(0);
    expect(listenersAtConnect).toEqual({ error: 1, notification: 1 });
    expect(fakes.clients).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fakes.clients).toHaveLength(2); // error + catch 只算一次失敗
  });

  it("第一次連上不 closeAll；斷線後重新 LISTEN 成功才 closeAll", async () => {
    const spy = vi.spyOn(getRegistry(), "closeAll");
    ensureListener();
    await vi.advanceTimersByTimeAsync(0);
    expect(fakes.clients).toHaveLength(1);
    expect(spy).not.toHaveBeenCalled();
    (fakes.clients[0] as Fake).emit("error", new Error("conn reset"));
    expect(spy).not.toHaveBeenCalled(); // 還沒接回
    await vi.advanceTimersByTimeAsync(1000);
    expect(fakes.clients).toHaveLength(2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("首次連線失敗、之後連上也要 closeAll（attempt > 0）", async () => {
    const spy = vi.spyOn(getRegistry(), "closeAll");
    let calls = 0;
    fakes.connectImpl = () => (++calls === 1 ? Promise.reject(new Error("down")) : Promise.resolve());
    ensureListener();
    await vi.advanceTimersByTimeAsync(0);
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fakes.clients).toHaveLength(2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("連線失敗退避指數成長", async () => {
    fakes.connectImpl = () => Promise.reject(new Error("down"));
    ensureListener();
    await vi.advanceTimersByTimeAsync(0);
    expect(fakes.clients).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fakes.clients).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fakes.clients).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fakes.clients).toHaveLength(3);
  });
});

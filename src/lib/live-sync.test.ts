import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startLiveSync, subscribeLiveSync, type EventSourceLike, type WindowLike } from "./live-sync";

class FakeES implements EventSourceLike {
  listeners = new Map<string, Array<(e: MessageEvent | Event) => void>>();
  closed = false;
  readyState = 0;
  static last: FakeES | null = null;
  static all: FakeES[] = [];
  constructor(public url: string) {
    FakeES.last = this;
    FakeES.all.push(this);
  }
  addEventListener(type: string, cb: (e: MessageEvent | Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), cb]);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  fire(type: string, data?: string) {
    if (type === "open") this.readyState = 1;
    for (const cb of this.listeners.get(type) ?? []) cb({ data } as MessageEvent);
  }
}

class FakeWindow implements WindowLike {
  listeners = new Map<string, Set<() => void>>();
  addEventListener(type: string, cb: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb);
  }
  removeEventListener(type: string, cb: () => void) {
    this.listeners.get(type)?.delete(cb);
  }
  fire(type: string) {
    for (const cb of this.listeners.get(type) ?? []) cb();
  }
}

const factory = (u: string) => new FakeES(u);

describe("live-sync", () => {
  beforeEach(() => {
    FakeES.last = null;
    FakeES.all = [];
  });

  it("只建一條連線；change 事件解析後廣播；stop 關閉", () => {
    const got: unknown[] = [];
    const off = subscribeLiveSync((m) => got.push(m));
    const stop = startLiveSync({ url: "/x", factory, win: null });
    const stop2 = startLiveSync({ url: "/x", factory, win: null });
    expect(FakeES.all).toHaveLength(1);
    const es = FakeES.last!;
    es.fire("open");
    es.fire("change", '{"kind":"task","id":"c1","updatedAt":"2026-10-17T00:00:00.000Z"}');
    es.fire("change", "not json");
    expect(got).toEqual([{ type: "event", event: { kind: "task", id: "c1", updatedAt: "2026-10-17T00:00:00.000Z" } }]);
    stop2();
    expect(es.closed).toBe(false); // 還有一個使用者
    stop();
    expect(es.closed).toBe(true);
    off();
  });

  it("第二次 open 才廣播 reconnected", () => {
    const got: unknown[] = [];
    const off = subscribeLiveSync((m) => got.push(m));
    const stop = startLiveSync({ url: "/x", factory, win: null });
    const es = FakeES.last!;
    es.fire("open");
    expect(got).toEqual([]);
    es.fire("open");
    expect(got).toEqual([{ type: "reconnected" }]);
    stop();
    off();
  });

  describe("瀏覽器放棄 EventSource（readyState 2）後自己重開", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("error + readyState 2 → 關舊的、1s 後建新的，新的 open 廣播 reconnected", () => {
      const got: unknown[] = [];
      const off = subscribeLiveSync((m) => got.push(m));
      const stop = startLiveSync({ url: "/x", factory, win: null });
      const first = FakeES.last!;
      first.fire("open");
      first.readyState = 2;
      first.fire("error");
      expect(first.closed).toBe(true);
      vi.advanceTimersByTime(999);
      expect(FakeES.all).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(FakeES.all).toHaveLength(2);
      const second = FakeES.last!;
      expect(second).not.toBe(first);
      expect(got).toEqual([]);
      second.fire("open");
      expect(got).toEqual([{ type: "reconnected" }]);
      stop();
      expect(second.closed).toBe(true);
      off();
    });

    it("連續失敗退避 1s → 2s → 4s，open 成功後歸零", () => {
      const stop = startLiveSync({ url: "/x", factory, win: null });
      const fail = () => {
        const es = FakeES.last!;
        es.readyState = 2;
        es.fire("error");
      };
      fail();
      vi.advanceTimersByTime(1000);
      expect(FakeES.all).toHaveLength(2);
      fail();
      vi.advanceTimersByTime(1999);
      expect(FakeES.all).toHaveLength(2);
      vi.advanceTimersByTime(1);
      expect(FakeES.all).toHaveLength(3);
      fail();
      vi.advanceTimersByTime(3999);
      expect(FakeES.all).toHaveLength(3);
      vi.advanceTimersByTime(1);
      expect(FakeES.all).toHaveLength(4);
      FakeES.last!.fire("open");
      fail();
      vi.advanceTimersByTime(1000);
      expect(FakeES.all).toHaveLength(5);
      stop();
    });

    it("error + readyState 0 / 1 → 不動（交給瀏覽器自己重連）", () => {
      const stop = startLiveSync({ url: "/x", factory, win: null });
      const es = FakeES.last!;
      es.readyState = 0;
      es.fire("error");
      es.readyState = 1;
      es.fire("error");
      vi.advanceTimersByTime(60_000);
      expect(es.closed).toBe(false);
      expect(FakeES.all).toHaveLength(1);
      stop();
    });

    it("退避中 stop() → 取消重開", () => {
      const stop = startLiveSync({ url: "/x", factory, win: null });
      const es = FakeES.last!;
      es.readyState = 2;
      es.fire("error");
      stop();
      vi.advanceTimersByTime(60_000);
      expect(FakeES.all).toHaveLength(1);
    });

    it("online：source 已關就立刻重開；pagehide 關掉 source；stop 後不再聽 window", () => {
      const win = new FakeWindow();
      const got: unknown[] = [];
      const off = subscribeLiveSync((m) => got.push(m));
      const stop = startLiveSync({ url: "/x", factory, win });
      const first = FakeES.last!;
      first.fire("open");
      win.fire("online"); // source 還活著 → 不動
      expect(FakeES.all).toHaveLength(1);
      first.readyState = 2;
      first.fire("error");
      win.fire("online");
      expect(FakeES.all).toHaveLength(2);
      vi.advanceTimersByTime(60_000);
      expect(FakeES.all).toHaveLength(2); // 退避 timer 已取消
      const second = FakeES.last!;
      second.fire("open");
      expect(got).toEqual([{ type: "reconnected" }]);
      win.fire("pagehide");
      expect(second.closed).toBe(true);
      stop();
      win.fire("online");
      expect(FakeES.all).toHaveLength(2);
      expect([...win.listeners.values()].every((s) => s.size === 0)).toBe(true);
      off();
    });
  });
});

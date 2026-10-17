import { describe, it, expect, beforeEach } from "vitest";
import { startLiveSync, subscribeLiveSync, type EventSourceLike } from "./live-sync";

class FakeES implements EventSourceLike {
  listeners = new Map<string, Array<(e: MessageEvent | Event) => void>>();
  closed = false;
  static last: FakeES | null = null;
  constructor(public url: string) { FakeES.last = this; }
  addEventListener(type: string, cb: (e: MessageEvent | Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), cb]);
  }
  close() { this.closed = true; }
  fire(type: string, data?: string) {
    for (const cb of this.listeners.get(type) ?? []) cb({ data } as MessageEvent);
  }
}

describe("live-sync", () => {
  beforeEach(() => { FakeES.last = null; });

  it("只建一條連線；change 事件解析後廣播；stop 關閉", () => {
    const got: unknown[] = [];
    const off = subscribeLiveSync((m) => got.push(m));
    const stop = startLiveSync({ url: "/x", factory: (u) => new FakeES(u) });
    const stop2 = startLiveSync({ url: "/x", factory: (u) => new FakeES(u) });
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
    subscribeLiveSync((m) => got.push(m));
    const stop = startLiveSync({ url: "/x", factory: (u) => new FakeES(u) });
    const es = FakeES.last!;
    es.fire("open");
    expect(got).toEqual([]);
    es.fire("open");
    expect(got).toEqual([{ type: "reconnected" }]);
    stop();
  });
});

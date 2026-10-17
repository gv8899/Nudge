// 瀏覽器端：整個分頁一條 EventSource，模組層 pub/sub。
// 瀏覽器內建自動重連；第二次以後的 open 廣播 reconnected 讓訂閱者補抓。
import type { SyncEvent } from "./sync-types";

export type LiveSyncMessage = { type: "event"; event: SyncEvent } | { type: "reconnected" };

export interface EventSourceLike {
  addEventListener(type: string, cb: (e: MessageEvent | Event) => void): void;
  close(): void;
}

const subscribers = new Set<(m: LiveSyncMessage) => void>();
let source: EventSourceLike | null = null;
let refCount = 0;

function broadcast(m: LiveSyncMessage) {
  for (const cb of subscribers) {
    try {
      cb(m);
    } catch (e) {
      console.error("[live-sync] subscriber threw:", e);
    }
  }
}

export function subscribeLiveSync(cb: (m: LiveSyncMessage) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function parseEvent(raw: unknown): SyncEvent | null {
  if (typeof raw !== "string") return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (v.kind === "any") return { kind: "any" };
    if (v.kind === "task" && typeof v.id === "string" && typeof v.updatedAt === "string") {
      return { kind: "task", id: v.id, updatedAt: v.updatedAt };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function startLiveSync(opts?: {
  url?: string;
  factory?: (url: string) => EventSourceLike;
}): () => void {
  refCount++;
  if (!source) {
    const url = opts?.url ?? "/api/sync/events";
    const factory = opts?.factory ?? ((u: string) => new EventSource(u) as unknown as EventSourceLike);
    const es = factory(url);
    source = es;
    let opens = 0;
    es.addEventListener("open", () => {
      opens++;
      if (opens > 1) broadcast({ type: "reconnected" });
    });
    es.addEventListener("change", (e) => {
      const ev = parseEvent((e as MessageEvent).data);
      if (ev) broadcast({ type: "event", event: ev });
    });
    // error：瀏覽器自己重連，不用處理；401 時 EventSource 會停在 CLOSED，
    // 使用者重新登入後 provider 重新 mount 會再建。
  }
  return () => {
    refCount--;
    if (refCount <= 0 && source) {
      source.close();
      source = null;
      refCount = 0;
    }
  };
}

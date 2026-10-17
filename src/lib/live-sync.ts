// 瀏覽器端：整個分頁一條 EventSource，模組層 pub/sub。
// 瀏覽器內建自動重連（只限網路錯誤）；第二次以後的 open 廣播 reconnected 讓訂閱者補抓。
// 重連時若拿到非 200 / 錯的 Content-Type（部署切換時常見），WHATWG 規定
// EventSource 永久停在 CLOSED（readyState 2）不再重試 → 這裡自己退避重開。
import type { SyncEvent } from "./sync-types";

export type LiveSyncMessage = { type: "event"; event: SyncEvent } | { type: "reconnected" };

export interface EventSourceLike {
  /** 0 CONNECTING / 1 OPEN / 2 CLOSED（同 EventSource）。 */
  readonly readyState: number;
  addEventListener(type: string, cb: (e: MessageEvent | Event) => void): void;
  close(): void;
}

/** 測試注入用的 window 介面（online / pagehide）。 */
export interface WindowLike {
  addEventListener(type: string, cb: () => void): void;
  removeEventListener(type: string, cb: () => void): void;
}

const CLOSED = 2;
const REOPEN_MIN_MS = 1_000;
const REOPEN_MAX_MS = 30_000;

const subscribers = new Set<(m: LiveSyncMessage) => void>();
let source: EventSourceLike | null = null;
let refCount = 0;
// 模組層：跨「重開的 source」累計，重開後的第一次 open 也算 reconnected。
let opens = 0;
let reopenAttempt = 0;
let reopenTimer: ReturnType<typeof setTimeout> | null = null;
let openSource: (() => void) | null = null;
let detachWindow: (() => void) | null = null;

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

function clearReopenTimer() {
  if (reopenTimer) {
    clearTimeout(reopenTimer);
    reopenTimer = null;
  }
}

function closeSource() {
  if (source) {
    source.close();
    source = null;
  }
}

function scheduleReopen() {
  if (reopenTimer || refCount <= 0) return;
  const delay = Math.min(REOPEN_MAX_MS, REOPEN_MIN_MS * 2 ** reopenAttempt);
  reopenAttempt++;
  reopenTimer = setTimeout(() => {
    reopenTimer = null;
    if (refCount > 0 && !source) openSource?.();
  }, delay);
}

export function startLiveSync(opts?: {
  url?: string;
  factory?: (url: string) => EventSourceLike;
  /** 預設用瀏覽器 window；非瀏覽器環境（vitest node）沒有就不掛。 */
  win?: WindowLike | null;
}): () => void {
  refCount++;
  if (!openSource) {
    const url = opts?.url ?? "/api/sync/events";
    const factory = opts?.factory ?? ((u: string) => new EventSource(u) as unknown as EventSourceLike);
    const open = () => {
      const es = factory(url);
      source = es;
      es.addEventListener("open", () => {
        if (source !== es) return;
        reopenAttempt = 0;
        opens++;
        if (opens > 1) broadcast({ type: "reconnected" });
      });
      es.addEventListener("change", (e) => {
        if (source !== es) return;
        const ev = parseEvent((e as MessageEvent).data);
        if (ev) broadcast({ type: "event", event: ev });
      });
      es.addEventListener("error", () => {
        if (source !== es) return;
        // readyState 0（CONNECTING）= 瀏覽器自己在重連，不用管。
        // readyState 2（CLOSED）= 瀏覽器放棄了（非 200 / 錯 Content-Type，含 401）→ 自己退避重開。
        if (es.readyState !== CLOSED) return;
        closeSource();
        scheduleReopen();
      });
    };
    openSource = open;
    open();

    const win = opts?.win !== undefined ? opts.win : typeof window !== "undefined" ? window : null;
    if (win) {
      // 網路恢復：source 已關（在退避中）就立刻重開，不等 timer。
      const onOnline = () => {
        if (refCount > 0 && !source) {
          clearReopenTimer();
          reopenAttempt = 0;
          openSource?.();
        }
      };
      // 分頁卸載 / 進 bfcache：主動關掉，別讓 server 留著半死連線（spec §3）。
      // 從 bfcache 回來（pageshow persisted）視同網路恢復，重開並補抓。
      const onPageHide = () => {
        clearReopenTimer();
        closeSource();
      };
      win.addEventListener("online", onOnline);
      win.addEventListener("pagehide", onPageHide);
      win.addEventListener("pageshow", onOnline);
      detachWindow = () => {
        win.removeEventListener("online", onOnline);
        win.removeEventListener("pagehide", onPageHide);
        win.removeEventListener("pageshow", onOnline);
      };
    }
  }
  return () => {
    refCount--;
    if (refCount <= 0) {
      refCount = 0;
      clearReopenTimer();
      closeSource();
      detachWindow?.();
      detachWindow = null;
      openSource = null;
      reopenAttempt = 0;
      opens = 0; // 完全停掉後重新開始（例如重新登入）不算 reconnected
    }
  };
}

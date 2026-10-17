// 卡片即時同步的 server 內部匯流排。
// - 進程內：SubscriberRegistry（userId → 一組 SSE send）。
// - 跨進程 / 跨實例：Postgres NOTIFY 'nudge_sync'；每個 process 一個專用
//   pg.Client LISTEN（不是 pool 借的，LISTEN 必須黏在同一條連線上）。
// - dev / prod 共用同一個 Postgres：對方的 NOTIFY 也會進來，只是多一次重抓，無害。
import { Client } from "pg";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { SyncChange, SyncEvent } from "./sync-types";

export type { SyncChange, SyncEvent };

export const SYNC_CHANNEL = "nudge_sync";

export type NotifyPayload = { userId: string } & SyncChange;

export function parseNotifyPayload(raw: string): NotifyPayload | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.userId !== "string" || !o.userId) return null;
  if (o.kind === "any") return { userId: o.userId, kind: "any" };
  if (o.kind === "task" && typeof o.id === "string" && typeof o.updatedAt === "string") {
    return { userId: o.userId, kind: "task", id: o.id, updatedAt: o.updatedAt };
  }
  return null;
}

type Subscriber = { send: (e: SyncEvent) => void; onClose?: () => void };

export class SubscriberRegistry {
  private byUser = new Map<string, Set<Subscriber>>();

  /**
   * `onClose`：server 要求結束這條 SSE 時呼叫（見 closeAll）—— route 傳自己的
   * cleanup，關掉 stream 讓 client 重連並跑 reconnected 補抓。
   */
  subscribe(userId: string, send: (e: SyncEvent) => void, onClose?: () => void): () => void {
    let set = this.byUser.get(userId);
    if (!set) {
      set = new Set();
      this.byUser.set(userId, set);
    }
    const sub: Subscriber = { send, onClose };
    set.add(sub);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      set!.delete(sub);
      if (set!.size === 0 && this.byUser.get(userId) === set) this.byUser.delete(userId);
    };
  }

  emit(userId: string, e: SyncEvent): number {
    const set = this.byUser.get(userId);
    if (!set) return 0;
    let delivered = 0;
    for (const { send } of set) {
      try {
        send(e);
        delivered++;
      } catch {
        // 單一連線壞掉不影響其他人；壞連線由 route 的 abort 清掉
      }
    }
    return delivered;
  }

  count(userId: string): number {
    return this.byUser.get(userId)?.size ?? 0;
  }

  /**
   * 結束所有本機 SSE 連線（LISTEN 斷過又接回時用：中間的 NOTIFY 已漏掉，
   * 關掉 stream 讓每個 client 重連並觸發 reconnected 補抓）。回傳關掉幾條。
   */
  closeAll(): number {
    const all = [...this.byUser.values()].flatMap((set) => [...set]);
    this.byUser.clear();
    for (const { onClose } of all) {
      try {
        onClose?.();
      } catch {
        // 單一連線關閉失敗不影響其他人
      }
    }
    return all.length;
  }
}

type SyncGlobals = {
  __nudgeSyncRegistry?: SubscriberRegistry;
  __nudgeSyncListener?: { client: Client | null; starting: boolean };
};
const g = globalThis as unknown as SyncGlobals;

export function getRegistry(): SubscriberRegistry {
  if (!g.__nudgeSyncRegistry) g.__nudgeSyncRegistry = new SubscriberRegistry();
  return g.__nudgeSyncRegistry;
}

/** 寫入成功後呼叫。走 pool（drizzle），永不 throw。 */
export async function publishSyncEvent(userId: string, change: SyncChange): Promise<void> {
  const payload = JSON.stringify({ userId, ...change });
  try {
    await db.execute(sql`select pg_notify(${SYNC_CHANNEL}, ${payload})`);
  } catch (e) {
    console.error("[sync-bus] pg_notify failed:", e);
  }
}

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/** 第一個 SSE 訂閱者進來時呼叫；之後 no-op。斷線自動退避重連。 */
export function ensureListener(): void {
  if (!g.__nudgeSyncListener) g.__nudgeSyncListener = { client: null, starting: false };
  const state = g.__nudgeSyncListener;
  if (state.client || state.starting) return;
  state.starting = true;
  // 這個 process 的 LISTEN 是否曾經斷過：斷過之後再接回，中間的 NOTIFY 已漏掉，
  // 要 closeAll() 讓所有本機 SSE client 重連補抓。第一次連上不算。
  let hadFailure = false;
  void connect(0);

  async function connect(attempt: number) {
    // keepAlive：閒置的 LISTEN 連線不被 NAT / proxy 靜默砍掉而不自知。
    const client = new Client({ connectionString: process.env.DATABASE_URL, keepAlive: true });
    let dead = false;
    // delayAttempt：這次退避用第幾級；下一輪從 delayAttempt+1 繼續累加。
    // 連線成功後出錯一律從第 0 級（1s）重新開始。
    const fail = (err: unknown, delayAttempt: number) => {
      if (dead) return; // 同一條連線只處理一次，避免重複建 LISTEN client
      dead = true;
      hadFailure = true;
      console.error("[sync-bus] listener failed:", err);
      client.removeAllListeners("notification");
      client.on("error", () => {}); // 吞掉後續遲到的 error，避免 uncaught
      void client.end().catch(() => {});
      if (state.client === client) state.client = null;
      state.starting = true;
      const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** delayAttempt);
      setTimeout(() => void connect(delayAttempt + 1), delay);
    };
    let connected = false;
    // handler 必須在 connect() 之前掛：連線途中 socket 死掉也不會 uncaught
    client.on("error", (err) => fail(err, connected ? 0 : attempt));
    client.on("notification", (msg) => {
      if (msg.channel !== SYNC_CHANNEL || !msg.payload) return;
      const p = parseNotifyPayload(msg.payload);
      if (!p) return;
      const { userId, ...change } = p;
      getRegistry().emit(userId, change as SyncChange);
    });
    try {
      await client.connect();
      await client.query(`LISTEN ${SYNC_CHANNEL}`);
      if (dead) return;
      connected = true;
      state.client = client;
      state.starting = false;
      if (hadFailure || attempt > 0) {
        hadFailure = false;
        const closed = getRegistry().closeAll();
        if (closed > 0) console.warn(`[sync-bus] listener reconnected; closed ${closed} SSE stream(s) for catch-up`);
      }
    } catch (err) {
      fail(err, attempt);
    }
  }
}

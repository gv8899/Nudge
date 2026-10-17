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

export class SubscriberRegistry {
  private byUser = new Map<string, Set<(e: SyncEvent) => void>>();

  subscribe(userId: string, send: (e: SyncEvent) => void): () => void {
    let set = this.byUser.get(userId);
    if (!set) {
      set = new Set();
      this.byUser.set(userId, set);
    }
    set.add(send);
    return () => {
      set!.delete(send);
      if (set!.size === 0) this.byUser.delete(userId);
    };
  }

  emit(userId: string, e: SyncEvent): number {
    const set = this.byUser.get(userId);
    if (!set) return 0;
    let delivered = 0;
    for (const send of set) {
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
  void connect(0);

  async function connect(attempt: number) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      await client.query(`LISTEN ${SYNC_CHANNEL}`);
      state.client = client;
      state.starting = false;
      client.on("notification", (msg) => {
        if (msg.channel !== SYNC_CHANNEL || !msg.payload) return;
        const p = parseNotifyPayload(msg.payload);
        if (!p) return;
        const { userId, ...change } = p;
        getRegistry().emit(userId, change as SyncChange);
      });
      client.on("error", (err) => {
        console.error("[sync-bus] listener error:", err);
        state.client = null;
        void client.end().catch(() => {});
        state.starting = true;
        void connect(0);
      });
    } catch (err) {
      console.error("[sync-bus] listener connect failed:", err);
      void client.end().catch(() => {});
      const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** attempt);
      setTimeout(() => void connect(attempt + 1), delay);
    }
  }
}

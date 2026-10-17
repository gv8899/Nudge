# 卡片即時同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打開中的卡片（Web / Mac / iOS）在別處修改後 1–2 秒內自動換成最新內容；正在編輯時不打擾。

**Architecture:** 伺服器新增 SSE 端點 `GET /api/sync/events`；既有的 `notifyUserDevices()` 多做一件事：`pg_notify('nudge_sync', …)`。每個 server process 用一個專用 `pg.Client` LISTEN，收到後推給該 user 的本機 SSE 訂閱者。三個客戶端各掛一條連線，收到事件後依同一條純規則（`decideRemoteChange`）決定「套用 / 忽略 / 只刷列表」，套用走既有 409 衝突的「換最新 + 編輯器重 mount」路徑。

**Tech Stack:** Next.js 16 App Router route handler（`ReadableStream`、Node runtime）、`pg` 8（LISTEN/NOTIFY）、瀏覽器 `EventSource`、SwiftUI + `URLSession.bytes(for:)`、vitest、Swift Testing。

**Spec:** `docs/superpowers/specs/2026-10-17-card-live-sync-design.md`

## Global Constraints

- 分支 `feat/card-live-sync`（疊在 `feat/card-image-blocks` 之上；合併順序：批次 1 先）。
- SSE 事件格式固定：`event: change` + `data: {"kind":"task","id":"<taskId>","updatedAt":"<ISO>"}` 或 `data: {"kind":"any"}`；心跳 `: ping\n\n` 每 25 秒。
- Postgres 頻道名固定 `nudge_sync`；payload JSON `{"userId","kind","id?","updatedAt?"}`。
- 回音判斷用**秒精度**比較 updatedAt（與 `PATCH /api/tasks/[id]` 409 判斷一致）。
- 閘門規則：本機有未存檔修改 → **不抓最新、不 seed、不重載**（Apple `CardRepository.get` 會 seed，所以連 get 都不能呼叫）。
- 端點只回該 user 自己的事件；未登入 401；Apple client 收到 401 停止重連。
- 不新增 UI 字串（本功能無可見 UI）。不加 feature flag（使用者決定，產品只有一人用）。
- Apple：只准 `Color.nudgeXxx`（本案無新 UI）；Swift 6 並行安全；`swift test --no-parallel`。
- dev / prod 共用 Postgres：NOTIFY 會互相聽到，設計上接受（spec §1.2）。
- 寫任何 Next.js code 前讀 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`（Streaming 一節）。

## Review Focus

1. **正在打字時別台改同一張卡** → 本機畫面不跳、游標不動；停筆存檔被 409 擋後才換成別台版本。測試：T4 / T8 的 `decideRemoteChange(hasPending: true)` → `"ignore"`；T7 手動第 4 條。
2. **自己存檔的回音** → 不重載自己（否則打字每 800ms 跳一次）。測試：T4 / T8 的「event.updatedAt 秒值 == base 秒值 → ignore」；T7 手動第 5 條。
3. **伺服器重啟 / 網路斷** → 三邊自動重連，不用重開 app；重連後補抓一次（避免斷線期間漏事件）。測試：T9 的退避序列測試；T5 的 `onopen` 觸發 `reconnected` 廣播；T7 手動第 6 條。
4. **多個 server process（HMR / 多實例）** → listener 只有一個、訂閱者不重複。測試：T1 的 `SubscriberRegistry` 增刪 + `globalThis` 單例測試。
5. **未登入 / token 過期連 SSE** → 401，Apple client 停止、不無限打。測試：T2 curl 無 Bearer → 401；T9 的 401 → `state == .stopped`。

---

## File Structure

| 檔案 | 責任 |
|---|---|
| `src/lib/sync-bus.ts`（新） | server 內部：`SubscriberRegistry`（userId → Set<send>）、`parseNotifyPayload`、`publishSyncEvent`（pg_notify）、`ensureListener`（專用 pg.Client LISTEN，globalThis 單例） |
| `src/lib/sync-bus.test.ts`（新） | registry / payload 純邏輯測試 |
| `src/app/api/sync/events/route.ts`（新） | SSE 端點：auth、stream、心跳、abort 清理 |
| `src/lib/notify-devices.ts`（改） | 簽名加 `change?`；`after()` 內多呼叫 `publishSyncEvent` |
| `src/app/api/tasks/[id]/route.ts`（改） | PATCH 帶 `{kind:"task", id, updatedAt}` |
| `src/lib/live-sync-rules.ts` + `.test.ts`（新） | `decideRemoteChange` 純規則（三平台鏡像的 Web 版） |
| `src/lib/debounced-saver.ts`（改）+ test | `isPending()` |
| `src/lib/live-sync.ts` + `.test.ts`（新） | 瀏覽器端 EventSource 單例 + pub/sub（`startLiveSync` / `subscribeLiveSync`） |
| `src/components/live-sync-provider.tsx`（新） | client component，mount 時 `startLiveSync()` |
| `src/app/[locale]/(app)/layout.tsx`（改） | 掛 `<LiveSyncProvider />` |
| `src/components/cards/card-detail.tsx`（改） | 訂閱 + 套用 |
| `src/components/cards/cards-feed.tsx`、`src/components/task/task-detail-modal.tsx`（改） | 卡片快速彈窗訂閱 + `onRemoteChange` |
| `apple/NudgeKit/Sources/NudgeCore/SSEParser.swift` + `RemoteChangeDecision.swift`（新） | 行解析器、純規則鏡像 |
| `apple/NudgeKit/Sources/NudgeCore/SyncStreamClient.swift`（新） | 長連線、退避重連、post `NudgeSync.changeNotification` |
| `apple/NudgeKit/Sources/NudgeCore/APIClient.swift`（改） | `eventStream(_ path:)` 回 `(URLSession.AsyncBytes, HTTPURLResponse)` |
| `apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift`（改） | 依 scenePhase start/stop |
| `apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift`、`CardsHostView.swift`（改） | 訂閱 + 閘門 + 套用；列表重抓 |
| `apple/Nudge-macOS/NudgeMacApp.swift`、`apple/Nudge-iOS/NudgeiOSApp.swift`（改） | 建 `SyncStreamClient` 並 `.environment` |
| `apple/NudgeKit/Tests/NudgeCoreTests/SSEParserTests.swift`、`RemoteChangeDecisionTests.swift`、`SyncStreamClientTests.swift`（新） | Swift 測試 |
| `AGENTS.md`（改） | 架構備忘一段 |

---

### Task 1: server 內部匯流排 `sync-bus.ts`（registry + payload + pg LISTEN/NOTIFY）

**Files:**
- Create: `src/lib/sync-bus.ts`
- Test: `src/lib/sync-bus.test.ts`

**Interfaces:**
- Consumes: `process.env.DATABASE_URL`；`db` from `@/lib/db`（`pg_notify` 用）。
- Produces:
  ```ts
  export type SyncChange = { kind: "task"; id: string; updatedAt: string } | { kind: "any" };
  export type SyncEvent = SyncChange; // 送給 client 的就是 change 本身
  export type NotifyPayload = { userId: string } & SyncChange;
  export function parseNotifyPayload(raw: string): NotifyPayload | null;
  export class SubscriberRegistry {
    subscribe(userId: string, send: (e: SyncEvent) => void): () => void;
    emit(userId: string, e: SyncEvent): number; // 回送達數
    count(userId: string): number;
  }
  export function getRegistry(): SubscriberRegistry; // globalThis 單例
  export function publishSyncEvent(userId: string, change: SyncChange): Promise<void>; // pg_notify，永不 throw
  export function ensureListener(): void; // 第一次呼叫才建 LISTEN client；重複呼叫 no-op
  ```

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/sync-bus.test.ts
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/sync-bus.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作**

```ts
// src/lib/sync-bus.ts
// 卡片即時同步的 server 內部匯流排。
// - 進程內：SubscriberRegistry（userId → 一組 SSE send）。
// - 跨進程 / 跨實例：Postgres NOTIFY 'nudge_sync'；每個 process 一個專用
//   pg.Client LISTEN（不是 pool 借的，LISTEN 必須黏在同一條連線上）。
// - dev / prod 共用同一個 Postgres：對方的 NOTIFY 也會進來，只是多一次重抓，無害。
import { Client } from "pg";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const SYNC_CHANNEL = "nudge_sync";

export type SyncChange =
  | { kind: "task"; id: string; updatedAt: string }
  | { kind: "any" };
export type SyncEvent = SyncChange;
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
```

- [ ] **Step 4: 跑測試**

Run: `npx vitest run src/lib/sync-bus.test.ts`
Expected: PASS（測試只碰純邏輯；`ensureListener` 不在測試中呼叫，所以不會連 DB）

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync-bus.ts src/lib/sync-bus.test.ts
git commit -m "feat(sync): server 內部匯流排（registry + pg LISTEN/NOTIFY）"
```

---

### Task 2: SSE 端點 `GET /api/sync/events`

**Files:**
- Create: `src/app/api/sync/events/route.ts`

**Interfaces:**
- Consumes: `getUser()` from `@/lib/get-user`；`getRegistry`, `ensureListener`, `SyncEvent` from `@/lib/sync-bus`。
- Produces: HTTP 端點，格式見 Global Constraints。

- [ ] **Step 1: 讀 Next.js 文件**

Read: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` 的「Streaming」一節（`ReadableStream` 用法）。

- [ ] **Step 2: 實作**

```ts
// src/app/api/sync/events/route.ts
import { NextRequest } from "next/server";
import { getUser } from "@/lib/get-user";
import { ensureListener, getRegistry, type SyncEvent } from "@/lib/sync-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;

/**
 * 卡片即時同步的 SSE 端點。登入後每個 client 掛一條；server 收到該 user 的
 * 變動（sync-bus）就推 `event: change`。payload 只有 kind / id / updatedAt，
 * 不含內容 —— client 收到再用既有 owner-scoped GET 去抓。
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  ensureListener();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (s: string) => controller.enqueue(encoder.encode(s));
      const send = (e: SyncEvent) => write(`event: change\ndata: ${JSON.stringify(e)}\n\n`);

      // 開場：讓 proxy / 瀏覽器立刻看到 body 開始（也驗證連線成功）
      write(`: connected\n\n`);
      const unsubscribe = getRegistry().subscribe(user.id, send);
      const heartbeat = setInterval(() => {
        try {
          write(`: ping\n\n`);
        } catch {
          /* controller 已關，由 abort 清理 */
        }
      }, HEARTBEAT_MS);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

- [ ] **Step 3: 本機驗證（curl + psql）**

dev server 已在 :3000。Bearer 取得方式與批次 1 T5 相同：用 repo 的 JWT helper + `.env.local` 的 `AUTH_SECRET` 替開發者自己的 user row 簽一顆短效 token（腳本放 `/private/tmp`，不 commit、不印 token）。

```bash
# 終端 A：掛連線（-N 不緩衝）
curl -N -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/sync/events
# 期望：立刻看到 ": connected"，之後每 25 秒一行 ": ping"

# 終端 B：手動發一個 NOTIFY（userId 用自己的 user id）
psql "$DATABASE_URL" -c "select pg_notify('nudge_sync', '{\"userId\":\"<USER_ID>\",\"kind\":\"task\",\"id\":\"t1\",\"updatedAt\":\"2026-10-17T00:00:00.000Z\"}')"
# 期望：終端 A 在 1 秒內印出
#   event: change
#   data: {"kind":"task","id":"t1","updatedAt":"2026-10-17T00:00:00.000Z"}

# 無 Bearer → 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/sync/events
```

把三個結果寫進回報。Ctrl-C 終端 A 後，dev log 不應出現 unhandled error。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sync/events/route.ts
git commit -m "feat(sync): GET /api/sync/events SSE 端點（auth、心跳、abort 清理）"
```

---

### Task 3: 寫入路徑發布事件（`notifyUserDevices` 擴充 + PATCH 帶卡片 id）

**Files:**
- Modify: `src/lib/notify-devices.ts:26-32`（簽名）、`after()` 區塊內
- Modify: `src/app/api/tasks/[id]/route.ts:91-93`

**Interfaces:**
- Consumes: `publishSyncEvent(userId, change)`、`SyncChange` from `@/lib/sync-bus`。
- Produces: `notifyUserDevices(userId: string, change?: SyncChange): void`（既有 13 個呼叫點不改即相容 → `{kind:"any"}`）。

- [ ] **Step 1: 改簽名與 after() 內容**

在 `src/lib/notify-devices.ts`：

```ts
import { publishSyncEvent, type SyncChange } from "@/lib/sync-bus";

export function notifyUserDevices(userId: string, change?: SyncChange): void {
  const originTokenPromise = headers()
    .then((h) => h.get("x-nudge-device-id"))
    .catch(() => null);

  after(async () => {
    // SSE：不節流、不排除發起裝置（回音由 client 以版本比對略過）。
    await publishSyncEvent(userId, change ?? { kind: "any" });

    try {
      // ……（原本 APNs 區塊完全不動）……
```

`publishSyncEvent` 永不 throw，放在 try 之外沒關係；放進去也可以，但要在 APNs 的 `claimed.length === 0 return` **之前**，否則沒有 iOS 裝置時 SSE 不會發。

- [ ] **Step 2: PATCH 帶 change**

`src/app/api/tasks/[id]/route.ts` 第 91–93 行改為：

```ts
  const [updated] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  notifyUserDevices(user.id, { kind: "task", id, updatedAt: updated.updatedAt });
  return NextResponse.json(updated);
```

（`tasks.updatedAt` 是 `text().notNull()`，型別為 `string`，直接帶。）

- [ ] **Step 3: 型別與測試**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "notify-devices|tasks/\[id\]/route|sync-bus"`（期望無輸出）
Run: `npm test`（期望全綠；既有測試數不變）

- [ ] **Step 4: 端到端驗證**

終端 A 掛著 Task 2 的 curl；在 Web 改任一張卡的內文（或用 curl PATCH）：

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"description":"<p>sync test</p>"}' http://localhost:3000/api/tasks/<TASK_ID> | head -c 120
```

期望：終端 A 1 秒內收到 `event: change` 且 `id` = 該卡、`updatedAt` = 回應裡的 updatedAt。改 tag（`PUT /api/tasks/<id>/tags`）→ 收到 `{"kind":"any"}`。

- [ ] **Step 5: Commit**

```bash
git add src/lib/notify-devices.ts "src/app/api/tasks/[id]/route.ts"
git commit -m "feat(sync): 寫入成功後發布 nudge_sync 事件（PATCH 帶卡片 id + updatedAt）"
```

---

### Task 4: Web 純規則 `decideRemoteChange` + `DebouncedSaver.isPending()`

**Files:**
- Create: `src/lib/live-sync-rules.ts`、`src/lib/live-sync-rules.test.ts`
- Modify: `src/lib/debounced-saver.ts`、`src/lib/debounced-saver.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type RemoteDecision = "apply" | "ignore" | "list-only";
  export function decideRemoteChange(args: {
    event: SyncEvent;            // from @/lib/sync-bus（型別可 import，無 server 依賴）
    cardId: string;
    baseUpdatedAt: string | null; // seedCardVersion 記的
    hasPending: boolean;          // 本機有未存檔修改
  }): RemoteDecision;
  export function sameSecond(a: string, b: string): boolean;
  // DebouncedSaver
  isPending(): boolean;
  ```
  注意：`SyncEvent` 型別從 `@/lib/sync-bus` import 會把 `pg` 拉進 client bundle。**改成**把型別獨立到 `src/lib/sync-types.ts`（`SyncChange` / `SyncEvent`），`sync-bus.ts` 改為 re-export：`export type { SyncChange, SyncEvent } from "./sync-types";`。

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/live-sync-rules.test.ts
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
```

在 `src/lib/debounced-saver.test.ts` 追加：

```ts
  it("isPending 反映 schedule / flush / cancel", () => {
    vi.useFakeTimers();
    const saved: string[] = [];
    const s = new DebouncedSaver<string>((v) => saved.push(v), 100);
    expect(s.isPending()).toBe(false);
    s.schedule("a");
    expect(s.isPending()).toBe(true);
    s.flush();
    expect(s.isPending()).toBe(false);
    s.schedule("b");
    s.cancel();
    expect(s.isPending()).toBe(false);
    vi.useRealTimers();
  });
```

（檔案若尚未 import `vi`，加 `import { vi } from "vitest"`。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/live-sync-rules.test.ts src/lib/debounced-saver.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作**

```ts
// src/lib/sync-types.ts
export type SyncChange =
  | { kind: "task"; id: string; updatedAt: string }
  | { kind: "any" };
export type SyncEvent = SyncChange;
```

`src/lib/sync-bus.ts`：刪掉本地的兩個 type 宣告，改為
`import type { SyncChange, SyncEvent } from "./sync-types"; export type { SyncChange, SyncEvent };`

```ts
// src/lib/live-sync-rules.ts
// 打開中的卡片收到同步事件要怎麼辦 —— 三平台共用的一條規則（Swift 鏡像：
// NudgeCore/RemoteChangeDecision.swift）。改這裡要一起改那邊 + 兩邊測試。
import type { SyncEvent } from "./sync-types";

export type RemoteDecision = "apply" | "ignore" | "list-only";

/** 與 server 409 判斷一致：秒精度比較。 */
export function sameSecond(a: string, b: string): boolean {
  return Math.floor(new Date(a).getTime() / 1000) === Math.floor(new Date(b).getTime() / 1000);
}

export function decideRemoteChange(args: {
  event: SyncEvent;
  cardId: string;
  baseUpdatedAt: string | null;
  hasPending: boolean;
}): RemoteDecision {
  const { event, cardId, baseUpdatedAt, hasPending } = args;
  if (event.kind !== "task" || event.id !== cardId) return "list-only";
  if (baseUpdatedAt) {
    if (sameSecond(event.updatedAt, baseUpdatedAt)) return "ignore";
    if (new Date(event.updatedAt).getTime() < new Date(baseUpdatedAt).getTime()) return "ignore";
  }
  // 本機有未存檔修改：不抓、不 seed、不重載 —— 等存檔被 409 擋再換最新。
  if (hasPending) return "ignore";
  return "apply";
}
```

`src/lib/debounced-saver.ts` 加：

```ts
  /** 有排程中、尚未送出的值。 */
  isPending(): boolean {
    return this.pending !== null;
  }
```

- [ ] **Step 4: 跑測試**

Run: `npx vitest run src/lib/live-sync-rules.test.ts src/lib/debounced-saver.test.ts src/lib/sync-bus.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync-types.ts src/lib/sync-bus.ts src/lib/live-sync-rules.ts src/lib/live-sync-rules.test.ts src/lib/debounced-saver.ts src/lib/debounced-saver.test.ts
git commit -m "feat(sync): decideRemoteChange 純規則 + DebouncedSaver.isPending"
```

---

### Task 5: 瀏覽器端連線 `live-sync.ts` + `LiveSyncProvider`

**Files:**
- Create: `src/lib/live-sync.ts`、`src/lib/live-sync.test.ts`、`src/components/live-sync-provider.tsx`
- Modify: `src/app/[locale]/(app)/layout.tsx:31`

**Interfaces:**
- Consumes: `SyncEvent` from `@/lib/sync-types`。
- Produces:
  ```ts
  export type LiveSyncMessage = { type: "event"; event: SyncEvent } | { type: "reconnected" };
  export function subscribeLiveSync(cb: (m: LiveSyncMessage) => void): () => void;
  export function startLiveSync(opts?: { url?: string; factory?: (url: string) => EventSourceLike }): () => void; // 回 stop
  export interface EventSourceLike { addEventListener(type: string, cb: (e: MessageEvent | Event) => void): void; close(): void; }
  ```
  `reconnected`：EventSource `open` 事件在**第二次之後**觸發時廣播（第一次連上不算），讓訂閱者補抓一次（斷線期間可能漏事件）。

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/live-sync.test.ts
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/live-sync.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作**

```ts
// src/lib/live-sync.ts
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
```

```tsx
// src/components/live-sync-provider.tsx
"use client";

import { useEffect } from "react";
import { startLiveSync } from "@/lib/live-sync";

/** 登入區殼層掛一次：整個分頁一條同步連線。無 UI。 */
export function LiveSyncProvider() {
  useEffect(() => startLiveSync(), []);
  return null;
}
```

`src/app/[locale]/(app)/layout.tsx` 最後一行改為：

```tsx
  return (
    <SidebarLayout>
      <LiveSyncProvider />
      {children}
    </SidebarLayout>
  );
```

並加 `import { LiveSyncProvider } from "@/components/live-sync-provider";`。

- [ ] **Step 4: 跑測試 + build**

Run: `npx vitest run src/lib/live-sync.test.ts` → PASS
Run: `npx next build 2>&1 | tail -5` → 無錯（特別確認 `pg` 沒被打進 client bundle：若 build 噴 `Module not found: Can't resolve 'pg'` 之類，代表哪個 client 檔 import 到 `sync-bus` 而不是 `sync-types`）。

- [ ] **Step 5: 瀏覽器驗證（手動，交給使用者或留到 Task 7）**

登入後開 DevTools Network，應看到 `events` 連線 type `eventsource` 持續 pending；每 25 秒有 ping。

- [ ] **Step 6: Commit**

```bash
git add src/lib/live-sync.ts src/lib/live-sync.test.ts src/components/live-sync-provider.tsx "src/app/[locale]/(app)/layout.tsx"
git commit -m "feat(sync): 瀏覽器端 EventSource 單例 + LiveSyncProvider"
```

---

### Task 6: Web 卡片頁與卡片快速彈窗套用事件

**Files:**
- Modify: `src/components/cards/card-detail.tsx`（imports、`patchTask` 之後新增 effect）
- Modify: `src/components/cards/cards-feed.tsx:30-62`
- Modify: `src/components/task/task-detail-modal.tsx`（props、effect）

**Interfaces:**
- Consumes: `subscribeLiveSync`、`LiveSyncMessage`；`decideRemoteChange`；`getCardVersion(id)`（新增於 `card-version.ts`：`export function getCardVersion(id: string): string | null { return baseByCardId.get(id) ?? null; }`）；`DebouncedSaver.isPending()`。
- Produces: `TaskDetailModal` 新 prop `onRemoteChange?: () => void`。

- [ ] **Step 1: `card-version.ts` 加 getter**

```ts
/** 目前記錄的基準版本（live sync 回音 / 新舊判斷用）。 */
export function getCardVersion(id: string): string | null {
  return baseByCardId.get(id) ?? null;
}
```

- [ ] **Step 2: `card-detail.tsx` 訂閱**

在 `patchTask`、`descSaver`、`titleSaver` 都宣告完之後加：

```tsx
  // 即時同步：別處改了這張卡 → 純檢視時換最新；正在打字（saver pending）
  // 時不動，交給存檔的 409 路徑。reconnected → 無條件補抓一次（斷線期間可能漏事件）。
  useEffect(() => {
    return subscribeLiveSync((m) => {
      const hasPending = descSaver.isPending() || titleSaver.isPending() || isTitleFocusedRef.current;
      if (m.type === "reconnected") {
        if (!hasPending) { mutate(); setReloadToken((n) => n + 1); }
        return;
      }
      const decision = decideRemoteChange({
        event: m.event,
        cardId: id,
        baseUpdatedAt: getCardVersion(id),
        hasPending,
      });
      if (decision === "list-only") { invalidateCardsCache(); return; }
      if (decision === "ignore") return;
      // apply：SWR 重抓 → data.updatedAt 變 → 既有 effect 會 seed 新基準；
      // 編輯器以 reloadToken 重 mount 載入新內文。
      void mutate().then(() => setReloadToken((n) => n + 1));
      invalidateCardsCache();
    });
  }, [id, mutate, descSaver, titleSaver]);
```

imports：`import { subscribeLiveSync } from "@/lib/live-sync"; import { decideRemoteChange } from "@/lib/live-sync-rules";` 並把 `getCardVersion` 加進既有的 `@/lib/card-version` import。

注意 `reloadToken` 重 mount 會把 `content={data.description}` 重載；`mutate()` 回來前 data 還是舊的，所以 **先 await mutate 再 ++**（上面已如此）。

- [ ] **Step 3: `task-detail-modal.tsx` 加 `onRemoteChange`**

props 加 `onRemoteChange?: () => void;`，解構加入。`descSaver` 宣告後加：

```tsx
  // 即時同步（parent 決定要不要重抓；這裡只負責「正在打字就別吵」的閘門）
  useEffect(() => {
    if (!open || !onRemoteChange) return;
    return subscribeLiveSync((m) => {
      const hasPending = descSaver.isPending() || isTitleFocusedRef.current;
      if (m.type === "reconnected") { if (!hasPending) onRemoteChange(); return; }
      const d = decideRemoteChange({
        event: m.event, cardId: task.id, baseUpdatedAt: getCardVersion(task.id), hasPending,
      });
      if (d === "apply") onRemoteChange();
    });
  }, [open, onRemoteChange, task.id, descSaver]);
```

（modal 內若有 titleSaver 也一併納入 `hasPending`。）

- [ ] **Step 4: `cards-feed.tsx` 接上**

在 `patch` 之後：

```tsx
  const handleRemoteChange = useCallback(async () => {
    await mutate();
    setEditorReloadToken((n) => n + 1);
    globalMutate((key) => typeof key === "string" && key.startsWith("/api/cards"), undefined, { revalidate: true });
  }, [mutate]);
```

`<TaskDetailModal … onRemoteChange={handleRemoteChange} />`。

`task-card.tsx` / `overdue-section.tsx` 的 TaskDetailModal **不接**（行動頁即時化另案，spec §6）。

- [ ] **Step 5: 型別、lint、build**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "card-detail|cards-feed|task-detail-modal|card-version"`（無輸出）
Run: `npx eslint src/components/cards/card-detail.tsx src/components/cards/cards-feed.tsx src/components/task/task-detail-modal.tsx src/lib/card-version.ts`（無新錯誤；repo baseline 有 63 個既有錯誤，只看這些檔）
Run: `npx next build 2>&1 | tail -3`

- [ ] **Step 6: Commit**

```bash
git add src/lib/card-version.ts src/components/cards/card-detail.tsx src/components/cards/cards-feed.tsx src/components/task/task-detail-modal.tsx
git commit -m "feat(sync): Web 卡片頁 / 卡片快速彈窗套用即時同步事件（打字中不打擾）"
```

---

### Task 7: Web 實測（Definition of Done）— 交給使用者

**Files:** 無。

- [ ] **Step 1: 兩個分頁同一張卡**

| # | 操作 | 期望 |
|---|---|---|
| 1 | 分頁 A 改內文、停筆 1 秒 | 分頁 B（純檢視）2 秒內換成新內容 |
| 2 | 分頁 A 改標題 | 分頁 B 標題 2 秒內更新 |
| 3 | 分頁 B 正在打字時，分頁 A 改同一張卡 | B 不跳動、游標不動；B 停筆存檔後 → B 換成 A 的版本（409 路徑） |
| 4 | 單一分頁連續打字 10 秒 | 自己不被重載、游標不跳（回音略過） |
| 5 | 在卡片列表開快速彈窗，另一分頁改該卡 | 彈窗 2 秒內更新 |
| 6 | 關 dev server 5 秒再開 | 分頁 DevTools 顯示 events 重連；之後同步照常；重連後內容最新 |
| 7 | DevTools Network | 只有一條 `events` 連線；每 25 秒一行 ping |

- [ ] **Step 2: 有 bug 修在對應檔案，commit 訊息 `fix(sync): Web 實測修正`**

---

### Task 8: Swift 純邏輯：`SSEParser` + `RemoteChangeDecision`

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/SSEParser.swift`、`apple/NudgeKit/Sources/NudgeCore/RemoteChangeDecision.swift`
- Test: `apple/NudgeKit/Tests/NudgeCoreTests/SSEParserTests.swift`、`apple/NudgeKit/Tests/NudgeCoreTests/RemoteChangeDecisionTests.swift`

**Interfaces:**
- Produces:
  ```swift
  public enum SyncEvent: Equatable, Sendable {
      case task(id: String, updatedAt: Date)
      case any
  }
  public struct SSEParser {           // 逐行餵，空行 = 事件結束
      public init()
      public mutating func feed(line: String) -> SyncEvent?
  }
  public enum RemoteDecision: Equatable, Sendable { case apply, ignore, listOnly }
  public enum RemoteChangeDecision {
      public static func decide(event: SyncEvent, cardId: String, base: Date?, hasPending: Bool) -> RemoteDecision
      public static func sameSecond(_ a: Date, _ b: Date) -> Bool
  }
  ```
  日期解析用 `NudgeISO8601.date(from:)`。

- [ ] **Step 1: 寫失敗測試**

```swift
// apple/NudgeKit/Tests/NudgeCoreTests/SSEParserTests.swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("SSEParser") struct SSEParserTests {
    @Test func parsesTaskEventTerminatedByBlankLine() {
        var p = SSEParser()
        #expect(p.feed(line: "event: change") == nil)
        #expect(p.feed(line: #"data: {"kind":"task","id":"c1","updatedAt":"2026-10-17T10:00:00.000Z"}"#) == nil)
        let ev = p.feed(line: "")
        #expect(ev == .task(id: "c1", updatedAt: NudgeISO8601.date(from: "2026-10-17T10:00:00.000Z")!))
    }
    @Test func ignoresHeartbeatAndUnknownEventNames() {
        var p = SSEParser()
        #expect(p.feed(line: ": ping") == nil)
        #expect(p.feed(line: "") == nil)
        #expect(p.feed(line: "event: other") == nil)
        #expect(p.feed(line: #"data: {"kind":"any"}"#) == nil)
        #expect(p.feed(line: "") == nil)   // event 名不是 change → 丟掉
    }
    @Test func anyEventAndMultilineData() {
        var p = SSEParser()
        _ = p.feed(line: "event: change")
        _ = p.feed(line: #"data: {"kind":"#)
        _ = p.feed(line: #"data: "any"}"#)
        #expect(p.feed(line: "") == .any)   // 多行 data 以 \n 接起來後仍是合法 JSON
    }
    @Test func badJSONYieldsNilAndResets() {
        var p = SSEParser()
        _ = p.feed(line: "event: change")
        _ = p.feed(line: "data: {nope")
        #expect(p.feed(line: "") == nil)
        _ = p.feed(line: "event: change")
        _ = p.feed(line: #"data: {"kind":"any"}"#)
        #expect(p.feed(line: "") == .any)
    }
}
```

```swift
// apple/NudgeKit/Tests/NudgeCoreTests/RemoteChangeDecisionTests.swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("RemoteChangeDecision") struct RemoteChangeDecisionTests {
    let base = NudgeISO8601.date(from: "2026-10-17T10:00:00.000Z")!
    let newer = NudgeISO8601.date(from: "2026-10-17T10:00:05.000Z")!
    let sameSec = NudgeISO8601.date(from: "2026-10-17T10:00:00.900Z")!

    @Test func otherCardIsListOnly() {
        #expect(RemoteChangeDecision.decide(event: .task(id: "x", updatedAt: newer), cardId: "c1", base: base, hasPending: false) == .listOnly)
        #expect(RemoteChangeDecision.decide(event: .any, cardId: "c1", base: base, hasPending: false) == .listOnly)
    }
    @Test func newerWithoutPendingApplies() {
        #expect(RemoteChangeDecision.decide(event: .task(id: "c1", updatedAt: newer), cardId: "c1", base: base, hasPending: false) == .apply)
        #expect(RemoteChangeDecision.decide(event: .task(id: "c1", updatedAt: newer), cardId: "c1", base: nil, hasPending: false) == .apply)
    }
    @Test func echoAndOlderAreIgnored() {
        #expect(RemoteChangeDecision.decide(event: .task(id: "c1", updatedAt: sameSec), cardId: "c1", base: base, hasPending: false) == .ignore)
        #expect(RemoteChangeDecision.decide(event: .task(id: "c1", updatedAt: base), cardId: "c1", base: newer, hasPending: false) == .ignore)
    }
    @Test func pendingEditsIgnore() {
        #expect(RemoteChangeDecision.decide(event: .task(id: "c1", updatedAt: newer), cardId: "c1", base: base, hasPending: true) == .ignore)
    }
}
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd apple/NudgeKit && swift test --no-parallel --filter "SSEParser|RemoteChangeDecision" 2>&1 | tail -5`
Expected: 編譯失敗（型別不存在）

- [ ] **Step 3: 實作**

```swift
// apple/NudgeKit/Sources/NudgeCore/SSEParser.swift
import Foundation

/// 伺服器同步事件（GET /api/sync/events）。
public enum SyncEvent: Equatable, Sendable {
    case task(id: String, updatedAt: Date)
    case any
}

/// 最小 SSE 解析器：逐行餵（`URLSession.AsyncBytes.lines` 已去掉換行），
/// 空行代表一個事件結束。只認 `event: change`；`:` 開頭是心跳 / 註解。
public struct SSEParser: Sendable {
    private var eventName: String?
    private var dataLines: [String] = []

    public init() {}

    public mutating func feed(line: String) -> SyncEvent? {
        if line.isEmpty {
            defer { eventName = nil; dataLines = [] }
            guard eventName == "change", !dataLines.isEmpty else { return nil }
            return Self.parse(data: dataLines.joined(separator: "\n"))
        }
        if line.hasPrefix(":") { return nil }
        if line.hasPrefix("event:") {
            eventName = line.dropFirst("event:".count).trimmingCharacters(in: .whitespaces)
        } else if line.hasPrefix("data:") {
            dataLines.append(String(line.dropFirst("data:".count).trimmingCharacters(in: .whitespaces)))
        }
        return nil
    }

    private struct Wire: Decodable {
        let kind: String
        let id: String?
        let updatedAt: String?
    }

    static func parse(data: String) -> SyncEvent? {
        guard let bytes = data.data(using: .utf8),
              let w = try? JSONDecoder().decode(Wire.self, from: bytes) else { return nil }
        switch w.kind {
        case "any":
            return .any
        case "task":
            guard let id = w.id, let s = w.updatedAt, let d = NudgeISO8601.date(from: s) else { return nil }
            return .task(id: id, updatedAt: d)
        default:
            return nil
        }
    }
}
```

```swift
// apple/NudgeKit/Sources/NudgeCore/RemoteChangeDecision.swift
import Foundation

public enum RemoteDecision: Equatable, Sendable { case apply, ignore, listOnly }

/// 打開中的卡片收到同步事件要怎麼辦 —— 與 Web `src/lib/live-sync-rules.ts`
/// 鏡像。改一邊，兩邊測試都要過。
public enum RemoteChangeDecision {
    /// 與 server 409 判斷一致：秒精度。
    public static func sameSecond(_ a: Date, _ b: Date) -> Bool {
        floor(a.timeIntervalSince1970) == floor(b.timeIntervalSince1970)
    }

    public static func decide(event: SyncEvent, cardId: String, base: Date?, hasPending: Bool) -> RemoteDecision {
        guard case .task(let id, let updatedAt) = event, id == cardId else { return .listOnly }
        if let base {
            if sameSecond(updatedAt, base) { return .ignore }
            if updatedAt < base { return .ignore }
        }
        // 本機有未存檔修改：不抓、不 seed、不重載（CardRepository.get 會 seed）。
        if hasPending { return .ignore }
        return .apply
    }
}
```

- [ ] **Step 4: 跑測試**

Run: `cd apple/NudgeKit && swift test --no-parallel --filter "SSEParser|RemoteChangeDecision" 2>&1 | tail -5`
Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeCore/SSEParser.swift apple/NudgeKit/Sources/NudgeCore/RemoteChangeDecision.swift apple/NudgeKit/Tests/NudgeCoreTests/SSEParserTests.swift apple/NudgeKit/Tests/NudgeCoreTests/RemoteChangeDecisionTests.swift
git commit -m "feat(apple-sync): SSEParser + RemoteChangeDecision（Web 規則鏡像）"
```

---

### Task 9: `SyncStreamClient`（長連線、退避重連、401 停止）+ `APIClient.eventStream`

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeCore/APIClient.swift`（加 public 方法）
- Create: `apple/NudgeKit/Sources/NudgeCore/SyncStreamClient.swift`
- Test: `apple/NudgeKit/Tests/NudgeCoreTests/SyncStreamClientTests.swift`

**Interfaces:**
- Consumes: `SSEParser`、`SyncEvent`（T8）；`APIClient.buildRequest`（private，於同檔內使用）。
- Produces:
  ```swift
  // APIClient
  public func eventStream(_ path: String) async throws -> (URLSession.AsyncBytes, HTTPURLResponse)
  // NudgeCore
  public enum NudgeSync {
      public static let changeNotification = Notification.Name("nudge.sync.change")
      public static let reconnectedNotification = Notification.Name("nudge.sync.reconnected")
      public static let eventKey = "event"   // userInfo[eventKey] as? SyncEvent（包在 SyncEventBox）
  }
  public final class SyncEventBox: NSObject, Sendable { public let event: SyncEvent }
  @MainActor @Observable public final class SyncStreamClient {
      public enum State: Equatable { case idle, connecting, connected, backingOff(seconds: Double), stopped(reason: String) }
      public private(set) var state: State
      public init(client: APIClient, path: String = "/api/sync/events", minBackoff: Double = 1, maxBackoff: Double = 30)
      public func start()
      public func stop()
      public static func nextBackoff(after current: Double?, min: Double, max: Double) -> Double  // 純函式，可測
  }
  ```

- [ ] **Step 1: 寫失敗測試**

```swift
// apple/NudgeKit/Tests/NudgeCoreTests/SyncStreamClientTests.swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("SyncStreamClient", .serialized) struct SyncStreamClientTests {
    @Test func backoffDoublesAndCaps() {
        #expect(SyncStreamClient.nextBackoff(after: nil, min: 1, max: 30) == 1)
        #expect(SyncStreamClient.nextBackoff(after: 1, min: 1, max: 30) == 2)
        #expect(SyncStreamClient.nextBackoff(after: 16, min: 1, max: 30) == 30)
        #expect(SyncStreamClient.nextBackoff(after: 30, min: 1, max: 30) == 30)
    }

    @MainActor @Test func postsChangeNotificationsFromStream() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.url?.path == "/api/sync/events")
            #expect(request.value(forHTTPHeaderField: "Accept") == "text/event-stream")
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer t")
            let body = """
            : connected

            event: change
            data: {"kind":"task","id":"c1","updatedAt":"2026-10-17T10:00:00.000Z"}

            event: change
            data: {"kind":"any"}

            """
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil,
                                           headerFields: ["Content-Type": "text/event-stream"])!
            return (body.data(using: .utf8)!, response)
        }
        let api = APIClient(configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
                            session: .mocked(), tokenProvider: { "t" })
        let sync = SyncStreamClient(client: api, minBackoff: 60, maxBackoff: 60) // 串流結束後會進 backingOff，60s 內不會重連

        var got: [SyncEvent] = []
        let token = NotificationCenter.default.addObserver(forName: NudgeSync.changeNotification, object: nil, queue: .main) { n in
            if let box = n.userInfo?[NudgeSync.eventKey] as? SyncEventBox { got.append(box.event) }
        }
        defer { NotificationCenter.default.removeObserver(token) }

        sync.start()
        try await Task.sleep(nanoseconds: 500_000_000)
        sync.stop()

        #expect(got == [.task(id: "c1", updatedAt: NudgeISO8601.date(from: "2026-10-17T10:00:00.000Z")!), .any])
        #expect(sync.state == .idle)
    }

    @MainActor @Test func unauthorizedStopsWithoutRetry() async throws {
        MockURLProtocol.handler = { request in
            (Data(), HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!)
        }
        let api = APIClient(configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!), session: .mocked())
        let sync = SyncStreamClient(client: api)
        sync.start()
        try await Task.sleep(nanoseconds: 300_000_000)
        #expect(sync.state == .stopped(reason: "unauthorized"))
        sync.stop()
    }
}
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd apple/NudgeKit && swift test --no-parallel --filter SyncStreamClient 2>&1 | tail -5`
Expected: 編譯失敗

- [ ] **Step 3: `APIClient.eventStream`**

在 `APIClient.swift` 的 `perform` 之前加：

```swift
    /// 長連線（SSE）：回傳位元組串流與回應。Accept 改為 text/event-stream，
    /// 不帶 If-None-Match（不是資源 GET）。401 丟 `.unauthorized`（並通知 handler），
    /// 其他非 2xx 丟 `.server(statusCode:message:)`。
    public func eventStream(_ path: String) async throws -> (URLSession.AsyncBytes, HTTPURLResponse) {
        var request = try buildRequest(method: "GET", path: path, body: Optional<Empty>.none)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue(nil, forHTTPHeaderField: "If-None-Match")
        request.timeoutInterval = 60 * 60 * 24
        let (bytes, response) = try await session.bytes(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if http.statusCode == 401 {
            if let handler = currentUnauthorizedHandler() { await handler() }
            throw APIError.unauthorized
        }
        guard (200...299).contains(http.statusCode) else {
            throw APIError.server(statusCode: http.statusCode, message: nil)
        }
        return (bytes, http)
    }
```

`currentUnauthorizedHandler()` 是 `perform` 已在用的既有 private helper。`Empty` 是同檔已存在的 `struct Empty: Codable {}`。

- [ ] **Step 4: `SyncStreamClient`**

```swift
// apple/NudgeKit/Sources/NudgeCore/SyncStreamClient.swift
import Foundation
import Observation

public enum NudgeSync {
    /// 收到一個同步事件。userInfo[eventKey] = SyncEventBox。
    public static let changeNotification = Notification.Name("nudge.sync.change")
    /// 斷線後重新連上（第二次以後的連線成功）—— 訂閱者應補抓一次。
    public static let reconnectedNotification = Notification.Name("nudge.sync.reconnected")
    public static let eventKey = "event"
}

public final class SyncEventBox: NSObject, Sendable {
    public let event: SyncEvent
    public init(_ event: SyncEvent) { self.event = event }
}

/// 卡片即時同步的長連線。前景且已登入時 `start()`，退背景 / 登出 `stop()`。
/// 斷線退避重連 1→2→4…≤30s；401 停止（等重新登入後再 start）。
@MainActor
@Observable
public final class SyncStreamClient {
    public enum State: Equatable, Sendable {
        case idle, connecting, connected
        case backingOff(seconds: Double)
        case stopped(reason: String)
    }

    public private(set) var state: State = .idle

    private let client: APIClient
    private let path: String
    private let minBackoff: Double
    private let maxBackoff: Double
    private var task: Task<Void, Never>?
    private var successfulConnections = 0

    public init(client: APIClient, path: String = "/api/sync/events", minBackoff: Double = 1, maxBackoff: Double = 30) {
        self.client = client
        self.path = path
        self.minBackoff = minBackoff
        self.maxBackoff = maxBackoff
    }

    public static func nextBackoff(after current: Double?, min: Double, max: Double) -> Double {
        guard let current else { return min }
        return Swift.min(max, current * 2)
    }

    public func start() {
        guard task == nil else { return }
        successfulConnections = 0
        task = Task { [weak self] in await self?.run() }
    }

    public func stop() {
        task?.cancel()
        task = nil
        state = .idle
    }

    private func run() async {
        var backoff: Double? = nil
        while !Task.isCancelled {
            state = .connecting
            do {
                let (bytes, _) = try await client.eventStream(path)
                state = .connected
                successfulConnections += 1
                if successfulConnections > 1 {
                    NotificationCenter.default.post(name: NudgeSync.reconnectedNotification, object: nil)
                }
                backoff = nil
                var parser = SSEParser()
                for try await line in bytes.lines {
                    if Task.isCancelled { return }
                    if let event = parser.feed(line: line) {
                        NotificationCenter.default.post(
                            name: NudgeSync.changeNotification, object: nil,
                            userInfo: [NudgeSync.eventKey: SyncEventBox(event)]
                        )
                    }
                }
                // 串流正常結束（server 重啟等）→ 走退避重連
            } catch is CancellationError {
                return
            } catch let e as APIError where e.isUnauthorized {
                state = .stopped(reason: "unauthorized")
                task = nil
                return
            } catch {
                // 網路錯 / 非 2xx → 退避重連
            }
            if Task.isCancelled { return }
            let wait = Self.nextBackoff(after: backoff, min: minBackoff, max: maxBackoff)
            backoff = wait
            state = .backingOff(seconds: wait)
            try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
        }
    }
}
```

`APIError.isUnauthorized`：若 `APIError` 還沒有這個便利屬性，在 `APIError.swift` 加 `public var isUnauthorized: Bool { if case .unauthorized = self { return true }; return false }`（對齊既有 `isCancellation` 的寫法）。

- [ ] **Step 5: 跑測試**

Run: `cd apple/NudgeKit && swift test --no-parallel --filter "SyncStreamClient|APIClient" 2>&1 | tail -8`
Expected: 新增 3 tests PASS；既有 APIClient tests 不變。

- [ ] **Step 6: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeCore/APIClient.swift apple/NudgeKit/Sources/NudgeCore/APIError.swift apple/NudgeKit/Sources/NudgeCore/SyncStreamClient.swift apple/NudgeKit/Tests/NudgeCoreTests/SyncStreamClientTests.swift
git commit -m "feat(apple-sync): SyncStreamClient 長連線（退避重連、401 停止）+ APIClient.eventStream"
```

---

### Task 10: Apple 接線（App 建 client、PlatformRootView 控生命週期、CardDetailView / CardsHostView 套用）

**Files:**
- Modify: `apple/Nudge-macOS/NudgeMacApp.swift`（`@State` + `.environment`，兩處 environment 群組都要加）
- Modify: `apple/Nudge-iOS/NudgeiOSApp.swift`（同上，一處）
- Modify: `apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift`
- Modify: `apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift`（conflictResolved handler 抽 `applyRemote`，新增 sync handler）
- Modify: `apple/NudgeKit/Sources/NudgeUI/Cards/CardsHostView.swift:194`

**Interfaces:**
- Consumes: `SyncStreamClient`、`NudgeSync.*`、`SyncEventBox`、`RemoteChangeDecision`、`CardVersionStore.base(cardId:)`、`CardRepository.get(cardId:)`。

- [ ] **Step 1: App 層**

`NudgeMacApp.swift`：在 `@State private var attachmentRepo: AttachmentRepository` 旁加 `@State private var syncStream: SyncStreamClient`；`init()` 內 `let client = …` 之後加 `_syncStream = State(initialValue: SyncStreamClient(client: client))`（對齊其他 repo 的初始化寫法）；兩處 `.environment(attachmentRepo)` 旁各加 `.environment(syncStream)`。
`NudgeiOSApp.swift`：同樣加 `@State`、init、一處 `.environment(syncStream)`。

- [ ] **Step 2: `PlatformRootView` 控生命週期**

```swift
public struct PlatformRootView: View {
    @Bindable var auth: AuthRepository
    @Environment(SyncStreamClient.self) private var syncStream: SyncStreamClient?
    @Environment(\.scenePhase) private var scenePhase

    public var body: some View {
        content
            // Mac：視窗開著就連著（inactive 只是不在前景）。iOS：只有 active 才連，
            // 退背景斷線、回前景重連（背景仍靠 APNs）。登出時 AuthGateView 會移除
            // 本 view → onDisappear 斷線。
            .task(id: scenePhase) {
                #if os(macOS)
                syncStream?.start()
                #else
                if scenePhase == .active { syncStream?.start() } else { syncStream?.stop() }
                #endif
            }
            .onDisappear { syncStream?.stop() }
    }

    @ViewBuilder private var content: some View { /* 原本 body 的 #if os(iOS) IOSTabRoot / MacSidebarRoot */ }
}
```

（`@Environment(SyncStreamClient.self) … : SyncStreamClient?` 的 optional 寫法與 `RichTextEditor` 的 `attachmentRepo` 一致，preview / 測試沒注入也不 crash。）

- [ ] **Step 3: `CardDetailView` 抽 `applyRemote` + 新 handler**

把既有 `conflictResolved` handler 內「取消排程 → suppress → 套 title/description → 清 dirty → reloadToken++ → 下一 runloop 解除」抽成：

```swift
    /// 用 server 最新內容替換畫面（409 衝突與即時同步共用）。呼叫前由呼叫端保證
    /// 「本機沒有未存檔修改」。
    private func applyRemote(title newTitle: String, description newDescription: String) {
        titleSaveWorkItem?.cancel(); titleSaveWorkItem = nil
        descriptionSaveWorkItem?.cancel(); descriptionSaveWorkItem = nil
        suppressEditDetection = true
        title = newTitle
        descriptionHTML = newDescription
        hasEditedTitle = false
        hasEditedDescription = false
        reloadToken += 1
        DispatchQueue.main.async { suppressEditDetection = false }
    }

    private var hasPendingLocalEdits: Bool {
        hasEditedTitle || hasEditedDescription || titleSaveWorkItem != nil || descriptionSaveWorkItem != nil
    }
```

conflictResolved handler 改為：`if hasEditedTitle || hasEditedDescription { return }` 保留，然後 `applyRemote(title: t, description: d)`。

新增兩個 handler（放在 conflictResolved 旁）：

```swift
        .onReceive(NotificationCenter.default.publisher(for: NudgeSync.changeNotification)) { note in
            guard let box = note.userInfo?[NudgeSync.eventKey] as? SyncEventBox else { return }
            let decision = RemoteChangeDecision.decide(
                event: box.event, cardId: initialCard.id,
                base: CardVersionStore.base(cardId: initialCard.id),
                hasPending: hasPendingLocalEdits
            )
            guard decision == .apply else { return }   // listOnly 由 CardsHostView 處理
            Task { await pullLatest() }
        }
        .onReceive(NotificationCenter.default.publisher(for: NudgeSync.reconnectedNotification)) { _ in
            if hasPendingLocalEdits { return }
            Task { await pullLatest() }
        }
```

```swift
    /// 抓最新並套用。閘門在呼叫端 —— 這裡的 get 會 seed 版本基準，有未存檔修改時
    /// 絕不能進來（否則接下來的本機存檔會通過版本檢查、覆蓋別台）。
    private func pullLatest() async {
        do {
            let latest = try await cardRepo.get(cardId: initialCard.id)
            if hasPendingLocalEdits { return }  // 抓的期間使用者開始打字 → 放棄（base 已被 seed，下次存檔會 409 → 既有路徑）
            applyRemote(title: latest.title, description: latest.description ?? "")
        } catch {
            if APIError.isCancellation(error) { return }
            // 失敗就等下一個事件 / 重連
        }
    }
```

> 注意上面 `pullLatest` 內的 race：get 期間使用者開始編輯，base 已被 seed 到最新 → 本機之後的存檔**會通過**版本檢查並覆蓋。可接受的原因：使用者是在「已看到最新事件到來前」的那 100–300ms 內開始打字，且存的是他此刻看到的內容；要完全避免需要 `CardRepository.get(cardId:seed:)` 參數。**實作者請直接加該參數**：`public func get(cardId: String, seedVersion: Bool = true)`，`pullLatest` 用 `seedVersion: false`，套用成功後自己 `CardVersionStore.seed(cardId:updatedAt: latest.updatedAt)`。這樣閘門才是完整的。

`CardDetailView` 的 `CardDTO.description` 若是非 optional，去掉 `?? ""`。

- [ ] **Step 4: `CardsHostView` 列表重抓**

第 194 行 `cardsChangedNotification` 的 onReceive 旁加：

```swift
        .onReceive(NotificationCenter.default.publisher(for: NudgeSync.changeNotification)) { _ in
            Task { await firstPage() }
        }
        .onReceive(NotificationCenter.default.publisher(for: NudgeSync.reconnectedNotification)) { _ in
            Task { await firstPage() }
        }
```

若 `firstPage()` 會把 Mac 右欄 / 全頁開著的卡片打掉重建（檢查 `fullPageCard` / `dashboardCardDetailCard` 是否由 list 資料派生），改為只刷列表資料、不動選取狀態；在報告裡寫明你查到的行為。

- [ ] **Step 5: 編譯 + 測試**

```bash
cd apple && xcodegen generate >/dev/null && \
xcodebuild -project Nudge.xcodeproj -scheme Nudge-macOS -configuration Debug -derivedDataPath ~/Library/Developer/Xcode/DerivedData/nudge-ops-mac -quiet build 2>&1 | tail -5 && \
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ~/Library/Developer/Xcode/DerivedData/nudge-ops-ios -quiet build 2>&1 | tail -5
cd NudgeKit && swift test --no-parallel 2>&1 | tail -5
```

Expected：兩個 build 成功；`swift test` 除既有已知失敗 `TaskRepository.write/updateTitlePatches` 外全綠。`./scripts/lint-swift-tokens.sh` 無違規（本案無顏色）。

- [ ] **Step 6: Commit**

```bash
git add apple/Nudge-macOS/NudgeMacApp.swift apple/Nudge-iOS/NudgeiOSApp.swift apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift apple/NudgeKit/Sources/NudgeUI/Cards/CardsHostView.swift apple/NudgeKit/Sources/NudgeCore/CardRepository.swift
git commit -m "feat(apple-sync): 前景長連線 + 卡片頁 / 列表套用即時同步（打字中不打擾）"
```

---

### Task 11: Apple 實測（Mac + iOS 模擬器）— 交給使用者

**Files:** 無。先重 build 並啟動（Mac `open -n <DerivedData>/Nudge-macOS.app`；iOS `simctl install` + `launch`，見批次 1 做法）。

| # | 操作 | 期望 |
|---|---|---|
| A1 | Web 改一張卡內文、停筆 1 秒 | Mac 打開中的同卡 2 秒內換內容；iOS 前景同卡 2 秒內換 |
| A2 | Mac 改字 | Web 同卡 2 秒內換 |
| A3 | Mac 正在打字時 Web 改同卡 | Mac 不跳動；Mac 停筆存檔 → 409 → Mac 保留自己的內容、推進基準，下一次存檔勝出（覆蓋 Web 版）；Mac 存檔完成後 Web 再改 → Mac 2 秒內換成 Web 版 |
| A4 | Mac 連續打字 10 秒 | 不被自己重載、游標不跳 |
| A5 | iOS 退到背景 → Web 改卡 → iOS 回前景 | 回前景 2 秒內內容最新（reconnected 補抓） |
| A6 | 關 dev server 5 秒再開 | Mac / iOS 自動重連（Console 無崩潰）；之後同步照常 |
| A7 | 卡片列表開著、Web 新增一張卡 | Mac / iOS 列表 2 秒內出現 |
| A8 | Mac 登出再登入 | 連線重建（登入後 A1 再過一次） |

---

### Task 12: 文件 + 收尾

**Files:**
- Modify: `AGENTS.md`（「架構備忘」新增一段）
- Modify: `docs/superpowers/specs/2026-10-17-card-live-sync-design.md` §3（任務彈窗範圍：卡片快速彈窗接、行動頁彈窗另案）

- [ ] **Step 1: AGENTS.md 加段**

```markdown
## 卡片即時同步 = SSE + Postgres NOTIFY

- `GET /api/sync/events`（SSE）每個登入 client 一條；server 寫入成功後 `notifyUserDevices(userId, change)` → `pg_notify('nudge_sync', …)`；每個 process 一個專用 pg.Client LISTEN（`src/lib/sync-bus.ts`），收到就推給該 user 的本機訂閱者。payload 只有 `{kind, id, updatedAt}`，不含內容。
- 客戶端規則一份兩鏡像：`src/lib/live-sync-rules.ts` ↔ `NudgeCore/RemoteChangeDecision.swift`。**本機有未存檔修改時不抓、不 seed、不重載**（Apple `CardRepository.get` 預設會 seed 基準，閘門內用 `seedVersion: false`）。改規則兩邊測試都要過。
- 回音判斷：事件 updatedAt 與本機基準**同一秒** → 略過（與 409 判斷同精度）。
- dev / prod 共用 Postgres，NOTIFY 互相聽得到，無害。
- 行動頁仍是 30 秒輪詢（未接即時）。對外公布前要補每 user 連線上限。
```

- [ ] **Step 2: spec §3 補一句**：「`task-detail-modal` 只在卡片快速彈窗（`cards-feed.tsx`）接 `onRemoteChange`；行動頁的任務彈窗隨行動頁即時化另案。」

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md docs/superpowers/specs/2026-10-17-card-live-sync-design.md
git commit -m "docs: 卡片即時同步架構備忘 + spec 範圍註記"
```

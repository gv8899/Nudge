# 卡片即時同步（打開中的卡片跟上別處的修改）— 設計規格

日期：2026-10-17
狀態：使用者已核准設計（對話中逐段核准），待實作計畫
前置：`feat/card-image-blocks`（批次 1）合併後另開分支 `feat/card-live-sync`

## 0. 問題與決策

**現況（2026-10-17 查證）**：三個平台都沒有「打開中的卡片跟上別處修改」的機制。

- iOS：APNs silent push 到了只重抓「行動」頁今天的資料（`PushSyncAppDelegate.refreshData` → `TaskRepository.refreshIfChanged`），不更新打開中的 `CardDetailView`。
- Mac：沒有註冊 remote notification（`apple/Nudge-macOS/` 無 `aps-environment`、無 AppDelegate）。「行動」頁有 30 秒輪詢（`DailyHostView.startPolling`），卡片頁沒有。
- Web：`card-detail.tsx` 用 SWR 抓 `/api/tasks/[id]`，回焦點會 revalidate，但 `TiptapEditor` 只在 `reloadToken` 變動（409）時重 mount，內容不會跟著換。
- 三邊唯一會換成最新的時機：停在舊版的裝置存檔 → server 409 → 採用最新（`CardVersionStore.conflictResolved` / `patchCardField` conflict）。這是防覆蓋，不是同步。

**使用者決策**：

| 題目 | 決定 |
|---|---|
| 範圍 | Mac + Web + iOS 三平台 |
| 延遲 | 1–2 秒，接近即時 |
| 做法 | A：伺服器長連線（SSE），三平台同一套；不用 APNs（Mac 要簽章權限、本機測不到、server 有 5 秒節流），不用 2 秒輪詢（耗電、體感 2–4 秒） |
| 碰撞 | 沿用現有：本機有未存檔修改時不替換，等存檔被 409 擋下再換最新 |
| 順序 | 批次 1 合併後另開分支；Mac 上傳（批次 2）排在本案之後 |

## 1. 伺服器

### 1.1 事件通道端點

`GET /api/sync/events` — Server-Sent Events，Node runtime，`export const dynamic = "force-dynamic"`。

- 驗證：`getUser()`（Bearer 優先、再 NextAuth cookie），未登入回 401。
- 回應標頭：`Content-Type: text/event-stream`、`Cache-Control: no-cache, no-transform`、`Connection: keep-alive`、`X-Accel-Buffering: no`。
- 每 25 秒送一行註解 `: ping\n\n` 當心跳。
- 事件格式（一行 JSON）：

```
event: change
data: {"kind":"task","id":"<taskId>","updatedAt":"<ISO>"}
```

  `kind` 目前只有 `"task"`；沒有 id 的變動（tags、notification-preferences 等）送 `{"kind":"any"}`。
- 連線在 client 斷開（`request.signal` abort）時釋放訂閱。
- 單一 process 內用一個 `Map<userId, Set<send>>` 保存訂閱者。

### 1.2 跨實例廣播：Postgres LISTEN / NOTIFY

- 頻道名 `nudge_sync`。payload = JSON `{"userId":"…","kind":"task","id":"…","updatedAt":"…"}`（< 8000 bytes 上限，遠小於）。
- 每個 server process 持有**一個**專用 `pg.Client`（不是 pool 借的）做 `LISTEN nudge_sync`；用 `globalThis` 單例避免 dev HMR 重複建立。斷線後 1s→30s 退避重連。
- 發送：`notifyUserDevices(userId, change?)` 內新增 `pg_notify('nudge_sync', $1)`（走現有 pool），與 APNs 同一個 `after()` 區塊，**永不 throw**。
- 收到 NOTIFY → 解析 → 推給該 userId 的本機訂閱者。
- **dev / prod 共用同一個 Postgres**：prod 的 NOTIFY 會到 dev server 的 listener，反之亦然。影響只是「連在 dev 的 client 多重抓一次」，資料本來就是同一份，無害。設計上接受。

### 1.3 `notifyUserDevices` 簽名擴充

```ts
export function notifyUserDevices(
  userId: string,
  change?: { kind: "task"; id: string; updatedAt: string }
): void
```

- `PATCH /api/tasks/[id]`（title / description 寫入成功後）帶 `{kind:"task", id, updatedAt: 寫入後的 updatedAt}`。
- 其餘 12 條呼叫點不改參數（→ `kind:"any"`）。
- APNs 部分行為不變（含 5 秒節流、排除發起裝置）。SSE 不節流、不排除發起裝置 —— 回音由 client 用版本比對略過（§2）。

### 1.4 風險

- **Zeabur 反向代理緩衝 SSE** → 事件延遲到連線結束才送出。標頭已加 `X-Accel-Buffering: no` 與 `no-transform`；部署後必驗：Web 兩分頁互改，第二個分頁 2 秒內更新。驗不過 → 退路是把端點改為 long-poll（`GET /api/sync/wait?since=`，server 最多掛 25 秒），client 介面不變。
- `next start` standalone 長連線數：單一使用者階段可忽略；對外公布前補每 user 連線上限（例：10）。

## 2. 客戶端套用規則（三平台同一條）

打開中的卡片 `C`（基準版本 `base` = `CardVersionStore` / `card-version.ts` 記的 updatedAt）收到事件 `e`：

1. `e.kind === "task" && e.id !== C.id` → 忽略（只刷卡片列表，見 5）。
2. `e.kind === "task" && e.updatedAt <= base`（秒精度比較，同 server 409 判斷）→ 自己剛存的回音，忽略。
3. **本機有未存檔修改**（Web：`DebouncedSaver` 有 pending；Apple：`hasEditedTitle || hasEditedDescription` 或 `titleSaveWorkItem / descriptionSaveWorkItem` 非 nil）→ **不做任何事、不抓最新、不 seed**。理由：抓最新會把 base 推到新版，接下來的本機存檔就會通過版本檢查、覆蓋別台的修改（Apple `CardRepository.get` 會 seed，所以連 get 都不能呼叫）。待本機存檔 → server 409 → 現有衝突路徑換最新。
4. 否則 → `GET /api/tasks/[id]` 抓最新 → 套用 title / description → 推進 base 到最新 updatedAt → 編輯器重 mount（`reloadToken++`，與 409 路徑相同）。
5. 任一事件 → 卡片列表重新抓（Web `invalidateCardsCache()`；Apple post `cardsChangedNotification`）。
6. `kind === "any"` → 只做 5。

已知取捨：第 4 步重 mount 會讓捲動位置回到頂端。只在「純檢視」狀態發生，第一版接受。

## 3. Web

- 新檔 `src/lib/live-sync.ts`：
  - `subscribeLiveSync(cb: (e: SyncEvent) => void): () => void` — 模組層 pub/sub。
  - `startLiveSync()`：建立**一條** `EventSource("/api/sync/events")`（同源、cookie 自動帶）；`onmessage` 解析後廣播；瀏覽器內建自動重連；頁面 `pagehide` 關閉。
- 新元件 `src/components/live-sync-provider.tsx`（client component，無 UI），掛在 `src/app/[locale]/(app)/layout.tsx` 的 `SidebarLayout` 旁，整個登入區只掛一次。
- `card-detail.tsx`：`useEffect` 訂閱；依 §2 判斷；pending 判斷新增 `DebouncedSaver.isPending()`（新增 getter，回 `pending !== null`）；套用 = `await mutate()` 後 `setReloadToken(n => n + 1)`（SWR 回來的 `data.updatedAt` 會經既有 effect seed）。
- `task-detail-modal.tsx`：本身不抓資料。訂閱後符合 §2 第 4 步時呼叫新 prop `onRemoteChange?: () => void`；parent（daily 頁）負責 refetch + `editorReloadToken++`。pending 判斷用 modal 自己的 saver。
- `task-detail-modal` 只在卡片快速彈窗（`cards-feed.tsx`）接 `onRemoteChange`；行動頁的任務彈窗隨行動頁即時化另案。
- 不改 `/api/cards` 的 SWR 設定。

## 4. Mac + iOS（共用 NudgeKit）

- 新檔 `NudgeCore/SyncStreamClient.swift`（`@MainActor @Observable`）：
  - `start()` / `stop()`；內部 `Task` 用 `URLSession.bytes(for:)` 讀 `GET /api/sync/events`，請求經 `APIClient.buildRequest` 帶 Bearer（需把 `buildRequest` 開成 internal 可用的 `makeRequest(path:)` 或在 APIClient 加 `eventStream(path:) -> URLRequest`）。
  - 逐行解析 SSE：累積 `data:` 行，空行 = 一個事件；忽略 `:` 開頭的心跳。
  - 每個事件 post `NudgeSync.changeNotification`（`Notification.Name("nudge.sync.change")`，userInfo：`kind`、`id?`、`updatedAt?`）。
  - 斷線 / 非 2xx → 退避重連 1s、2s、4s … 上限 30s；401 → 停止，等下次 `start()`（重新登入）。
  - 單元測試：SSE 行解析器獨立成純函式 `SSEParser.feed(_ line:) -> SyncEvent?`。
- 生命週期：
  - Mac `NudgeMacApp`：已登入 → `start()`；登出 → `stop()`。Mac 無背景概念，視窗開著就連著。
  - iOS `NudgeiOSApp`：`scenePhase == .active && 已登入` → `start()`；離開 active → `stop()`。背景仍靠既有 APNs。
- `CardDetailView`：新增 `.onReceive(NudgeSync.changeNotification)`，依 §2：
  - 閘門先判 `hasEditedTitle || hasEditedDescription || titleSaveWorkItem != nil || descriptionSaveWorkItem != nil` → return（**不呼叫 `cardRepo.get`**）。
  - 通過 → `let latest = try await cardRepo.get(cardId)`（會 seed）→ 套用 title / description → `suppressEditDetection = true` → `reloadToken += 1` → 下一 runloop 解除（與 conflictResolved 處理完全相同；把那段抽成 `applyRemote(title:description:)` 給兩處共用）。
- `CardsHostView`：收到任何 sync 事件 → post / 直接 `firstPage()`（已有 `cardsChangedNotification` 處理）。
- `DailyHostView` 30 秒輪詢**不動**（§6）。

## 5. 安全

- 端點只回該 user 自己的事件（server 端以 userId 分流，payload 不含內容，只含 id 與時間）。
- 未登入 401；token 失效時 Apple client 停止重連，不無限打。
- payload 中的 id 由 client 再用既有的 owner-scoped `GET /api/tasks/[id]` 抓內容，越權仍 404。

## 6. 不做

- 兩邊同時打字的即時合併（CRDT / OT）。後存的一方被 409 擋、改用先存版本，與現況相同。
- 「行動」頁從 30 秒輪詢改即時 —— 另案，可直接重用 `SyncStreamClient` / `subscribeLiveSync`。
- 日誌（notes）即時同步。
- 捲動位置保留（重 mount 後回頂端）。
- 對外公布前的每 user 連線上限與速率限制（記入 pre-launch 清單）。

## 7. 測試

- 單元：
  - server：`parseNotifyPayload`、事件序列化、訂閱表增刪。
  - Web：`live-sync.ts` pub/sub；`DebouncedSaver.isPending`；§2 判斷抽成純函式 `shouldApplyRemoteChange({event, base, hasPending}) -> "apply" | "ignore" | "list-only"` 並測六條規則。
  - Swift：`SSEParser` 行解析（心跳、多行 data、空行分隔）；`shouldApplyRemoteChange` 鏡像測試。
- 手動（DoD）：
  1. Web A 改字 → Web B（同卡，純檢視）2 秒內換內容。
  2. Web 改字 → Mac 同卡 2 秒內換；Mac 改字 → Web 2 秒內換。
  3. Web 改字 → iOS 模擬器前景同卡 2 秒內換；iOS 退背景再回前景 → 內容最新（重連後列表 + 卡片）。
  4. Mac 正在打字時 Web 改同卡 → Mac 不跳動；Mac 停筆存檔 → 被 409 擋 → Mac 換成 Web 版（現有行為）。
  5. 自己存檔不觸發自己重載（回音略過）：連續打字 10 秒，游標不跳。
  6. 關 dev server 再開 → 三邊自動重連，不用重啟 app。
  7. 部署 Zeabur 後重跑 1、2（驗 §1.4 緩衝風險）。

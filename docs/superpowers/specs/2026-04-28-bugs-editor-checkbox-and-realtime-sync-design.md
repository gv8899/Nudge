# Bugs — 編輯器 checkbox cursor 跳掉 + Web/iOS/Widget 即時同步

日期：2026-04-28
範圍：Web (Next.js)、iOS (NudgeKit)、Widget extension（被動受惠）
影響市場：所有

## 動機

iOS Widget v1 上線後檢討列出的 bug，挑兩個影響使用者信任的處理：

- **B1**：Web 編輯器的 TipTap TaskList checkbox 行為不穩 — 建立後 cursor 飛到別處、勾選後該 row 視覺位置抖動，間歇性發生。讓人覺得編輯器「不可靠」。
- **B2**：三個 surface（Web、iOS App、Widget）之間沒有即時同步 — 使用者在一邊改了，另一邊要過很久（甚至一直）才看到。多裝置使用者首要痛點。

兩個 bug 看似無關，但都是「資料 / 狀態一致性」類問題，併在同一份 spec 裡處理。

## B1 — Editor checkbox cursor / 位置 drift

### 症狀

1. **建立 checkbox 時 cursor 跳掉**：使用者在 TipTap 編輯器內透過 slash command 或鍵盤輸入產生 task list checkbox 後，cursor 跳到非預期位置（通常是 doc 的更下方）。
2. **點擊 checkbox 勾選 / 取消後 row 視覺位置改變**：原本在第 N 行的 checkbox row，勾選後似乎被「重新插入」到別處。
3. **間歇性**：使用者描述「不是每次會出現」— 同一動作不一定觸發。

兩個 surface 都受影響：卡片詳情、日誌 canvas、任務描述（都用同一個 `createCardEditor` / `createNoteEditor` 構築的 TipTap 實例）。

### 懷疑來源

- `src/components/editor/split-task-list.ts` — 自製 `SplitTaskList` extension，`appendTransaction` hook 內檢查 task list 結構並改 doc（拆分 / 合併 task list 群組）
- 已知 ProseMirror 模式：plugin 內 `appendTransaction` 改 doc 後，**必須** 自己處理 selection mapping，否則 selection 會用舊 position mapping 到改寫後的 doc，落到不預期位置
- 「間歇性」典型源於 race：當 checkbox 切換的 transaction 與 SplitTaskList 的 appendTransaction 同 frame fire，selection mapping 順序影響結果

### 修法

1. **Reproduce**：local dev 起 web、開卡片、用 slash command 加 task list、做以下操作組合直到再現：
   - 在 task item 內按 Enter
   - 點 checkbox 勾選 / 取消
   - 在不同 task list 群組之間移動 cursor
2. **定位**：開 ProseMirror dev tools（或 console.log selection）看每個 transaction 後 selection.from / .to 的值，找到改變不合理的 transaction
3. **修補**：`SplitTaskList.appendTransaction` 結尾、return 修改後的 tr 之前，補：
   ```ts
   const oldSelection = state.selection;
   const newSelection = oldSelection.map(tr.doc, tr.mapping);
   tr.setSelection(newSelection);
   ```
   或對應 ProseMirror Selection.map API（依檔案實際 import）
4. **Validation**：連續執行 step 1 操作 10 次以上 cursor 都正確、無位置抖動，視為修復

### 不做

- 不做大改 SplitTaskList 邏輯（風險高，現行只有 selection mapping 的 bug）
- 不換掉 TaskList extension（功能正確，只是 selection 一條路漏處理）

### 影響檔案

- `src/components/editor/split-task-list.ts`（主要）
- 可能 `src/components/editor/editor-extensions.ts`（如果 selection 處理拆出去）

## B2 — Smart polling + ETag 短路

### 目標

三邊資料 30 秒內反映對方變動，不導入 server push 架構（避免 SSE / WebSocket / channel auth / reconnect / 衝突解決等大幅工程）。

明確的取捨：使用者改了之後最久 30 秒會看到 — 不是「秒同步」，但「等一下就會出現」夠用。

### 架構

```
┌──────────────┐                            ┌──────────────┐
│  iOS App     │  GET /api/daily/{date}     │  Backend     │
│  (foreground)│  + If-None-Match: <last>   │  Next.js     │
│  Timer 30s   │  ──────────────────────►   │  /api/daily/ │
│              │  ◄──── 304 No Content ───  │  [date]      │
│              │  ◄──── 200 + body ────     │              │
└──────────────┘  (only when changed)        └──────────────┘
       │
       ├──► writes snapshot.json
       └──► WidgetCenter.reloadAllTimelines()

┌──────────────┐                            
│  Web (SWR)   │  refreshInterval: 30000    
│  visible tab │  refreshWhenHidden: false  
│              │  瀏覽器自動帶 If-None-Match
└──────────────┘  (透過 ETag + Cache-Control: no-cache)

┌──────────────┐
│  Widget      │  讀 App Group snapshot.json
│              │  靠 iOS App 寫入觸發
└──────────────┘  iOS reloadAllTimelines()
```

### Server — ETag on `/api/daily/[date]`

只做這個 endpoint（最常用、最大同步痛點）。其他 endpoint（cards list、notes feed、week summary）v2 視需求加。

**ETag 計算**：
- 取出該 date 範圍內所有 assignment + 對應 task 的 `updatedAt`
- ETag value：`"W/" + md5(maxUpdatedAt.toISOString())`（weak ETag — 等價值 vs bytewise 一致）
- 若該日無任何 task / assignment：`"W/empty"`

**邏輯**：
- 收 request → 算 server-side ETag
- 若 request header `If-None-Match` 等於 server ETag → 回 `304 No Content`，body 空
- 不一致正常回 `200` + body + response header `ETag: <value>` + `Cache-Control: no-cache`

`Cache-Control: no-cache`（注意：不是 `no-store`）告訴瀏覽器「每次都驗證」，配合 ETag 走標準 HTTP 304 流程。

### Web — `src/hooks/use-daily.ts`

加 3 個 SWR option：

```ts
useSWR<DailyData>(`/api/daily/${date}`, fetcher, {
  keepPreviousData: true,
  shouldRetryOnError: false,
  refreshInterval: 30000,        // 新增
  refreshWhenHidden: false,      // 新增 — tab 切走暫停
  refreshWhenOffline: false,     // 新增 — 沒網路暫停
});
```

不需改 `fetcher.ts` — fetch API 配合 server 的 `Cache-Control: no-cache` + `ETag`，瀏覽器 HTTP cache 自動帶 `If-None-Match` 並處理 304（304 時 fetch 仍回 cached body、SWR 比對「資料一樣」不重 render）。

### iOS — `TaskRepository` + App 層 polling

#### `APIClient` 加 ETag 支援

`apple/NudgeKit/Sources/NudgeCore/APIClient.swift`：

- 加 actor / dictionary 存 `etagCache: [String: String]`（path → ETag）
- `get<T: Decodable>(_:)` 加 `If-None-Match` header（如果 cache 內有對應 path 的 ETag）
- 收 response 時：
  - 304 → 不解 body，丟 `APIError.notModified`（特殊型別 caller 接住 = no-op）
  - 200 → 解 body、更新 etagCache（從 response header 取 `ETag`）

#### `TaskRepository.refreshIfChanged(date:)`

新 method：
```swift
public func refreshIfChanged(date: String) async {
    do {
        let data = try await client.get("/api/daily/\(date)") as DailyDataDTO
        try await updateCache(for: date, data: data)
        await widgetRefresher?.refresh()
    } catch APIError.notModified {
        // No-op — 既有資料就是最新
    } catch {
        if !APIError.isCancellation(error) {
            print("[TaskRepository] refreshIfChanged failed: \(error)")
        }
    }
}
```

#### Polling 觸發

放在 `DailyHostView`（最自然的 owner — view 在 = 該 polling，view 不在不該 polling）：

```swift
@Environment(\.scenePhase) private var scenePhase
@State private var pollingTask: Task<Void, Never>?

.onChange(of: scenePhase) { _, phase in
    pollingTask?.cancel()
    if phase == .active {
        pollingTask = Task { await pollLoop() }
    }
}
.onDisappear {
    pollingTask?.cancel()
    pollingTask = nil
}

private func pollLoop() async {
    while !Task.isCancelled {
        try? await Task.sleep(nanoseconds: 30_000_000_000)
        if Task.isCancelled { break }
        await taskRepo.refreshIfChanged(date: selectedDate)
    }
}
```

啟動條件：`scenePhase == .active` AND view 還在。背景 / 切到別 tab / view 消失都自動停。

### Widget — 被動受惠

Widget 不主動 polling。每次 iOS App polling 拉到新資料 → `widgetRefresher.refresh()` → 寫 snapshot.json + `reloadAllTimelines()`。Widget 在前景時 30 秒內看到 App polling 觸發的更新。

iOS 系統對 widget reload 有 budget，`reloadAllTimelines()` 不保證每次都會立刻 re-render — 但對 polling 來的更新已經夠用（最差情況 widget 等到下次 system schedule 才更新，仍在分鐘級）。

### 不在 v1 範圍

- Server push（SSE / WebSocket / Pusher / Liveblocks）
- 衝突解決（多裝置同時編輯同一 task）— 維持 last-write-wins
- 其他 endpoint 加 ETag（cards list / notes feed / week summary / search） — 待 v2 視使用者反饋
- 背景 polling（iOS BGTask、Web Service Worker）— 進背景就停
- 主動 push notification 觸發 widget reload

## 測試計畫（Definition of Done）

### B1

- [ ] Web dev：開卡片 → 加 task list → 連按 Enter 5 次新增 row → cursor 永遠在新建的 row 內，不跳到 doc 結尾
- [ ] 點 checkbox 勾選 → 該 row 視覺位置不變，cursor 留在原處
- [ ] 點 checkbox 取消 → 同上
- [ ] 連續操作（建 + 勾 + 反勾 + 換行）20 次 — 每次行為一致，不再出現「不是每次出現」
- [ ] 三 surface 都驗：卡片詳情、日誌 canvas、Daily 任務描述

### B2

**Web ↔ iOS sync**：
- [ ] iOS App 內勾完任務 → Web 在 30 秒內顯示完成（無需手動 refresh）
- [ ] Web 內改任務標題 → iOS App 在 30 秒內顯示新標題
- [ ] 雙邊同時改不同任務 → 30 秒內互看（不衝突）

**Widget sync**：
- [ ] Web 內勾完任務 → iOS App 30 秒內反映 → 同時 widget 也 30 秒內反映

**Polling 行為驗證**：
- [ ] iOS App 進背景 → Activity Monitor / log 看不到 polling 請求
- [ ] iOS App 回前景 → 立刻或最遲 30 秒內 polling 恢復
- [ ] Web tab 切到別 tab → DevTools Network 看不到 polling 請求
- [ ] Web tab 切回 → 立刻或最遲 30 秒內 polling 恢復
- [ ] 沒網路（airplane mode）→ polling 請求暫停或快速失敗、不 spam log

**ETag 短路驗證**：
- [ ] Server log：90% 以上的 polling request 回 304（payload 空）
- [ ] 真正有變動時回 200 + body
- [ ] DevTools Network：304 response payload size < 200 byte

### 編譯

- [ ] `next build` 通過
- [ ] iOS / macOS xcodebuild 通過

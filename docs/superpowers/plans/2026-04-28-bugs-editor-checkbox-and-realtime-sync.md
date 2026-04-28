# Bugs — 編輯器 checkbox + Web/iOS/Widget 即時同步 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修兩個跨 surface 一致性 bug — Web 編輯器 TipTap TaskList checkbox cursor 跳掉（B1），與 Web ↔ iOS App ↔ Widget 三邊資料不會即時同步（B2）。

**Architecture:** B1 = 在 `SplitTaskList.appendTransaction` 結尾補 ProseMirror selection mapping。B2 = server `/api/daily/[date]` 加 ETag header → Web SWR `refreshInterval: 30000` 走瀏覽器 HTTP cache 自動 304 → iOS `APIClient` 帶 `If-None-Match`、`TaskRepository.refreshIfChanged()` 接住 `.notModified`、`DailyHostView` 起 30s polling Task 跟著 `scenePhase` start/cancel；Widget 被動受惠。

**Tech Stack:** TipTap (`@tiptap/pm/state`)、Next.js Route Handlers、SWR、SwiftUI scenePhase、Swift `Task` cancellation、URLSession `If-None-Match`。

**參考 spec：** `docs/superpowers/specs/2026-04-28-bugs-editor-checkbox-and-realtime-sync-design.md`

**重要規則（覆寫 skill 預設）：**
- **Commit message 用繁體中文**（prefix 保留英文 conventional）。
- **等使用者實機測試通過才 commit**。Task 1–6 只改 code + 區域驗證（build / type-check / 單元 test）。Task 7 請使用者 web + sim 實測。Task 8 才 commit。
- iOS 改 view layer 必須 build + install + relaunch sim 才算驗證。

---

## File Structure

| 路徑 | 動作 | 內容 |
|------|------|------|
| `src/components/editor/split-task-list.ts` | Modify | `appendTransaction` 結尾補 `tr.setSelection(state.selection.map(tr.doc, tr.mapping))` |
| `src/app/api/daily/[date]/route.ts` | Modify | GET 回 ETag + Cache-Control: no-cache，收 If-None-Match 一致回 304 |
| `src/hooks/use-daily.ts` | Modify | SWR options 加 `refreshInterval` / `refreshWhenHidden` / `refreshWhenOffline` |
| `apple/NudgeKit/Sources/NudgeCore/APIError.swift` | Modify | 加 `case notModified` |
| `apple/NudgeKit/Sources/NudgeCore/APIClient.swift` | Modify | 加 ETag 內部 cache + GET 帶 If-None-Match + 304 處理 |
| `apple/NudgeKit/Sources/NudgeData/TaskRepository.swift` | Modify | 加 `public func refreshIfChanged(date:)` |
| `apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift` | Modify | 加 30s polling Task，scenePhase 啟動 / cancel |

---

## Task 1: B1 — `SplitTaskList` selection mapping

**Files:**
- Modify: `src/components/editor/split-task-list.ts:70-99`

- [ ] **Step 1.1: 修 `appendTransaction` 在 return 前補 selection mapping**

打開 `src/components/editor/split-task-list.ts`，找到 `addProseMirrorPlugins` 內的 `appendTransaction`。目前 return 邏輯：

```typescript
return changed ? tr : null;
```

改為：

```typescript
if (!changed) return null;
// ProseMirror 的 selection 在 doc 改寫後不會自動跟著 tr.mapping 走 ——
// 必須手動 map 一次，否則 cursor 會跳到不預期位置（split 後的舊 position
// 已不存在）。間歇性出現是因為 selection 是否落在被改寫的範圍內取決於
// 使用者操作時 cursor 在哪。
const mappedSelection = newState.selection.map(tr.doc, tr.mapping);
tr.setSelection(mappedSelection);
return tr;
```

完整 plugin block 變成：

```typescript
addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("splitTaskList"),
        appendTransaction(_transactions, _oldState, newState) {
          const { doc, schema } = newState;
          const taskListType = schema.nodes.taskList;
          if (!taskListType) return null;

          let tr = newState.tr;
          let changed = false;

          const toSplit: Array<{ pos: number; node: typeof doc }> = [];
          doc.forEach((node, pos) => {
            if (node.type === taskListType && node.childCount > 1) {
              toSplit.push({ pos, node: node as any });
            }
          });

          for (let i = toSplit.length - 1; i >= 0; i--) {
            const { pos, node } = toSplit[i];
            const items: any[] = [];
            (node as any).forEach((child: any) => {
              items.push(taskListType.create(null, child));
            });

            tr.replaceWith(pos, pos + (node as any).nodeSize, items);
            changed = true;
          }

          if (!changed) return null;
          const mappedSelection = newState.selection.map(tr.doc, tr.mapping);
          tr.setSelection(mappedSelection);
          return tr;
        },
      }),
    ];
}
```

- [ ] **Step 1.2: TypeScript / Web build 通過**

```bash
cd /Users/mike/Documents/nudge && npx tsc --noEmit 2>&1 | tail -5
```

預期：無錯誤輸出。

```bash
npx next build 2>&1 | tail -5
```

預期：build 成功（routes 編好、無 type error）。

- [ ] **Step 1.3: 不 commit**

留 Task 8。

---

## Task 2: B2 — Server `/api/daily/[date]` 加 ETag + 304

**Files:**
- Modify: `src/app/api/daily/[date]/route.ts`

- [ ] **Step 2.1: 在 route handler 內計算 ETag、處理 If-None-Match、回 304 / 200**

`src/app/api/daily/[date]/route.ts` 目前最後一段是：

```typescript
return NextResponse.json({
    date,
    assignments,
    overdueTasks,
    noteContent: note?.content || "",
});
```

需要在 `return` 前計算 ETag 並比對 request header。在 file 頂部加 import：

```typescript
import { createHash } from "crypto";
```

把 `GET` 函式 signature 改回吃 `request` 參數（目前是 `_request`）：

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
```

替換結尾的 return 段為：

```typescript
  // ETag — weak hash of (max(updatedAt of all assignments + overdue tasks
  // for this date)). 變動就變、沒變動回 304 + 空 body 短路。
  const allUpdatedAts: number[] = [];
  for (const a of assignments) {
    allUpdatedAts.push(new Date(a.task.updatedAt).getTime());
  }
  for (const a of overdueTasks) {
    allUpdatedAts.push(new Date(a.task.updatedAt).getTime());
  }
  if (note?.updatedAt) {
    allUpdatedAts.push(new Date(note.updatedAt).getTime());
  }
  const maxUpdated = allUpdatedAts.length > 0 ? Math.max(...allUpdatedAts) : 0;
  const etagSource = `${date}|${maxUpdated}|${assignments.length}|${overdueTasks.length}`;
  const etag = `W/"${createHash("md5").update(etagSource).digest("hex")}"`;

  // Honor If-None-Match — 一致就回 304，不送 body
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "no-cache",
      },
    });
  }

  return NextResponse.json(
    {
      date,
      assignments,
      overdueTasks,
      noteContent: note?.content || "",
    },
    {
      headers: {
        ETag: etag,
        "Cache-Control": "no-cache",
      },
    }
  );
}
```

注意：`note?.updatedAt` — 看 `dailyNotes` schema 的欄位名是否為 `updatedAt`。確認一下 select query (line 146-150) 沒有 `updatedAt` field — 目前 select 是 `db.select().from(dailyNotes)` (`.select()` 不指定欄位 → 全選），所以 `note.updatedAt` 應該存在。如果 schema 沒有 `updatedAt` 欄位，從 ETag 計算移除該行，改為附加 `note?.content?.length` 作為弱簽：

```typescript
  if (note?.content) {
    allUpdatedAts.push(note.content.length);
  }
```

實作時打開 `src/lib/db/schema.ts` 查 `dailyNotes` 確認，依實情擇一。

- [ ] **Step 2.2: 手動驗證 ETag + 304 流程**

啟動 dev server：

```bash
cd /Users/mike/Documents/nudge && npx next dev > /tmp/next.log 2>&1 &
sleep 5
```

用 curl 測（替換 `<JWT>` 為有效 token；可從瀏覽器登入後 DevTools → Application → Cookies / localStorage 取出）：

```bash
TODAY=$(date +%Y-%m-%d)
TOKEN="<JWT>"

# 第一次 — 應拿到 200 + body + ETag header
curl -i -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/daily/$TODAY" 2>&1 | head -10

# 把第一次的 ETag 抓出來
ETAG=$(curl -s -D - -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/daily/$TODAY" -o /dev/null | grep -i "^etag:" | sed 's/etag: //I' | tr -d '\r\n')
echo "Got ETag: $ETAG"

# 第二次帶 If-None-Match — 應拿到 304 + 空 body
curl -i -H "Authorization: Bearer $TOKEN" -H "If-None-Match: $ETAG" "http://localhost:3000/api/daily/$TODAY" 2>&1 | head -10
```

預期：
- 第一次：`HTTP/1.1 200 OK` + `ETag: W/"<hash>"` + `Cache-Control: no-cache`
- 第二次：`HTTP/1.1 304 Not Modified` + `ETag: W/"<同一個 hash>"`，body 為空

- [ ] **Step 2.3: 不 commit**

---

## Task 3: B2 — Web SWR `refreshInterval`

**Files:**
- Modify: `src/hooks/use-daily.ts`

- [ ] **Step 3.1: 加 3 個 SWR option**

`src/hooks/use-daily.ts` 完整檔案目前 21 行；replace 整個 hook 內容：

```typescript
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { DailyData } from "@/lib/types";

export function useDaily(date: string) {
  const { data, error, isLoading, mutate } = useSWR<DailyData>(
    `/api/daily/${date}`,
    fetcher,
    {
      keepPreviousData: true,
      shouldRetryOnError: false,
      // Smart polling — 每 30s 檢查；server 回 304 時瀏覽器 HTTP cache
      // 自動命中（Cache-Control: no-cache + ETag），SWR 拿到「相同資料」
      // 不會 re-render。
      refreshInterval: 30000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}
```

- [ ] **Step 3.2: Web build + 手測**

```bash
cd /Users/mike/Documents/nudge && npx next build 2>&1 | tail -5
```

預期：build 成功。

dev server 還在跑（Task 2.2 啟動的）。瀏覽器開 `http://localhost:3000`、登入、進到 Daily 頁。打開 DevTools → Network → filter `daily`：

- 應該每 30 秒看到一個 `/api/daily/<date>` request
- 大部分回 304（payload 幾 byte）
- 切到別 tab → polling 暫停（無新 request）
- 切回該 tab → polling 立刻恢復

- [ ] **Step 3.3: 不 commit**

---

## Task 4: B2 — iOS `APIClient` ETag 支援 + `.notModified`

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeCore/APIError.swift:3-8`
- Modify: `apple/NudgeKit/Sources/NudgeCore/APIClient.swift`

- [ ] **Step 4.1: APIError 加 `notModified`**

`apple/NudgeKit/Sources/NudgeCore/APIError.swift` 的 enum 加新 case：

```swift
public enum APIError: Error, Sendable, LocalizedError {
    case unauthorized
    case network(underlying: (any Error)?)
    case server(statusCode: Int, message: String?)
    case decoding(underlying: any Error)
    case invalidResponse
    case notModified
```

也在現有的 `errorDescription` switch 加對應 case：

```swift
case .notModified:
    return "Resource not modified (304)"
```

- [ ] **Step 4.2: APIClient 加 ETag cache 欄位**

在 `APIClient` class（`apple/NudgeKit/Sources/NudgeCore/APIClient.swift`）內，現有 `_unauthorizedHandler` lock 模式下方加：

```swift
    // ETag cache — 給 GET request 帶 If-None-Match。寫法與
    // _unauthorizedHandler 一致：NSLock + nonisolated(unsafe) dict。
    private let etagLock = NSLock()
    private nonisolated(unsafe) var _etagCache: [String: String] = [:]
```

加兩個 private accessor（放在現有 `currentUnauthorizedHandler()` 下方）：

```swift
    private func cachedETag(for path: String) -> String? {
        etagLock.lock()
        defer { etagLock.unlock() }
        return _etagCache[path]
    }

    private func storeETag(_ etag: String, for path: String) {
        etagLock.lock()
        defer { etagLock.unlock() }
        _etagCache[path] = etag
    }
```

- [ ] **Step 4.3: `buildRequest` 在 GET 時帶 If-None-Match**

修改 `buildRequest`（line 115-137），在 `Authorization` header 之後加：

```swift
    private func buildRequest<Body: Encodable>(
        method: String,
        path: String,
        body: Body?
    ) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: configuration.baseURL) else {
            throw APIError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token = tokenProvider?() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // GET-only: 帶上同 path 的 last-seen ETag，server 一致回 304
        if method == "GET", let etag = cachedETag(for: path) {
            request.setValue(etag, forHTTPHeaderField: "If-None-Match")
        }

        if let body, !(body is Empty) {
            request.httpBody = try encoder.encode(body)
        }

        return request
    }
```

- [ ] **Step 4.4: `perform` 處理 304 + 從 response 抓 ETag**

修改 `perform<Response:>` 的 status code switch — 在 `200..<300` case 之前加 `304`，並在成功時存 ETag：

替換現有 switch（line 156-174）為：

```swift
        switch httpResponse.statusCode {
        case 304:
            throw APIError.notModified
        case 200..<300:
            // 存 ETag 供下次 GET 用
            if request.httpMethod == "GET",
               let etag = httpResponse.value(forHTTPHeaderField: "ETag"),
               let path = request.url?.path {
                storeETag(etag, for: path)
            }
            if Response.self == Empty.self {
                return Empty() as! Response
            }
            do {
                return try decoder.decode(Response.self, from: data)
            } catch {
                let body = String(data: data.prefix(300), encoding: .utf8) ?? "<binary>"
                print("[APIClient] decode failed for \(Response.self): \(error)\n  body: \(body)")
                throw APIError.decoding(underlying: error)
            }
        case 401:
            if let handler = currentUnauthorizedHandler() { await handler() }
            throw APIError.unauthorized
        default:
            let message = (try? decoder.decode(ErrorPayload.self, from: data))?.error
            throw APIError.server(statusCode: httpResponse.statusCode, message: message)
        }
```

注意：用 `request.url?.path` 而不是傳入 `path` 字串 — 確保 cache key 與 buildRequest 看到的一致（包含 query string 的處理 etc）。

- [ ] **Step 4.5: Build 通過**

```bash
cd /Users/mike/Documents/nudge/apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' build 2>&1 | tail -3
```

預期：`** BUILD SUCCEEDED **`。

- [ ] **Step 4.6: 不 commit**

---

## Task 5: B2 — `TaskRepository.refreshIfChanged(date:)`

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeData/TaskRepository.swift`

- [ ] **Step 5.1: 加新 public method**

在 `TaskRepository` class（`apple/NudgeKit/Sources/NudgeData/TaskRepository.swift`）內，現有 `refreshWidgetSnapshot()` 旁邊加：

```swift
    /// Polling-friendly refresh — 帶上 cached ETag 打 dailyData，server
    /// 回 304 直接 no-op；只有真有變動才更新本地 SwiftData cache 與 widget
    /// snapshot。給 30s 自動 polling 用，避免每次都拉 full payload。
    public func refreshIfChanged(date: String) async {
        do {
            let data: DailyDataDTO = try await client.get("/api/daily/\(date)")
            try await updateCache(for: date, data: data)
            await widgetRefresher?.refresh()
        } catch APIError.notModified {
            // 沒變動，無事發生
        } catch {
            if !APIError.isCancellation(error) {
                print("[TaskRepository] refreshIfChanged failed: \(error)")
            }
        }
    }
```

放在 `refreshWidgetSnapshot()` 下方。

- [ ] **Step 5.2: Build 通過**

```bash
cd /Users/mike/Documents/nudge/apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' build 2>&1 | tail -3
```

預期：`** BUILD SUCCEEDED **`。

- [ ] **Step 5.3: 不 commit**

---

## Task 6: B2 — `DailyHostView` 30s polling Task

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift`

- [ ] **Step 6.1: 加 polling state + scenePhase observer**

`DailyHostView` 已經有 `@Environment(\.scenePhase)` 嗎？看一下：先 `grep -n "scenePhase\|Polling\|pollingTask" apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift | head -5` 確認。如果還沒，需要加 `@Environment(\.scenePhase) private var scenePhase`。

加新 `@State`：

```swift
    @State private var pollingTask: Task<Void, Never>?
```

放在現有 `@State private var ...` 群組內。

- [ ] **Step 6.2: 加 polling start / cancel 邏輯**

在 view body 的最外層 NavigationStack / Group / 主容器上掛兩個 modifier。找到 view body 內的根容器（DailyHostView 的 body 結構複雜，但根 view 上會有現成的 `.task { ... }` 或 `.onAppear`）。在那附近加：

```swift
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                startPolling()
            } else {
                pollingTask?.cancel()
                pollingTask = nil
            }
        }
        .onAppear {
            // scenePhase 在 view 第一次出現時若已是 .active 不會 fire
            // onChange，所以開頭也手動 start 一次
            if scenePhase == .active {
                startPolling()
            }
        }
        .onDisappear {
            pollingTask?.cancel()
            pollingTask = nil
        }
```

- [ ] **Step 6.3: 加 `startPolling` / loop method**

在 DailyHostView 的私有 method 區（任何 `private func ...` 旁邊）加：

```swift
    /// 啟動 30 秒 polling loop。Idempotent — 重複呼叫先 cancel 舊的。
    /// scenePhase != active、view disappear、selectedDate 換都會被外層
    /// cancel 掉，loop 自然結束。
    private func startPolling() {
        pollingTask?.cancel()
        pollingTask = Task { [weak taskRepo] in
            while !Task.isCancelled {
                // 30 秒 — 用 nanoseconds 避免新 API 在較舊 deployment
                // target 上不可用的問題
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                if Task.isCancelled { break }
                guard let repo = taskRepo else { break }
                let today = DateFormatters.isoDate(Date())
                await repo.refreshIfChanged(date: today)
            }
        }
    }
```

注意：`taskRepo` 是 `@Environment(TaskRepository.self)` 取出的值；在 closure capture 用 `[weak taskRepo]` 避免 retain cycle。`TaskRepository` 是 `@Observable @MainActor public final class` — 是 reference type，weak capture 合法。

- [ ] **Step 6.4: Build + macOS 都通過**

```bash
cd /Users/mike/Documents/nudge/apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' build 2>&1 | tail -3 && xcodebuild -project Nudge.xcodeproj -scheme Nudge-macOS build 2>&1 | tail -3
```

預期：兩個 `** BUILD SUCCEEDED **`。

- [ ] **Step 6.5: Reinstall sim**

```bash
xattr -cr /Users/mike/Library/Developer/Xcode/DerivedData/Nudge-bzdovxlrguhtnnbcshiusqacygrp/Build/Products/Debug-iphonesimulator/Nudge-iOS.app
xcrun simctl terminate CEB11490-5C95-4528-9125-B0BB7E02DC0D tw.nudge.app 2>/dev/null
xcrun simctl install CEB11490-5C95-4528-9125-B0BB7E02DC0D /Users/mike/Library/Developer/Xcode/DerivedData/Nudge-bzdovxlrguhtnnbcshiusqacygrp/Build/Products/Debug-iphonesimulator/Nudge-iOS.app
xcrun simctl launch CEB11490-5C95-4528-9125-B0BB7E02DC0D tw.nudge.app
```

- [ ] **Step 6.6: 不 commit**

---

## Task 7: 整合實測（請使用者操作）

依 spec 測試計畫逐項勾。

- [ ] **Step 7.1: B1 — 編輯器 checkbox**

請使用者在 web（dev server，`http://localhost:3000`）：

1. 進到 Cards tab → 開任一卡片
2. 用 slash command 加 task list
3. 連按 Enter 5 次新增 row → cursor 應永遠落在新 row
4. 點 checkbox 勾選 → row 視覺位置不變、cursor 留在原 paragraph
5. 連續做（建 + 勾 + 反勾 + 換行）20 次 — 不再間歇出現 cursor 跳掉
6. 同樣測試在 Notes canvas、Daily 任務描述

- [ ] **Step 7.2: B2 — Web ↔ iOS sync**

使用者操作：

1. iOS App sim 開到 Daily tab
2. 同時 web 在另一台或瀏覽器另開、登入、進到 Daily
3. 在 iOS 勾完成一個任務 → web 應在 30 秒內顯示完成（無需手動 reload）
4. 在 web 改任務標題 → iOS 應在 30 秒內顯示新標題
5. Widget（先在 sim 裝 Today's 5 widget）— web 改任務 → 30 秒內 widget 也反映

- [ ] **Step 7.3: B2 — Polling 行為**

1. iOS App 進背景 30 秒 → console log 看不到 `[APIClient] GET /api/daily/...`（polling 應暫停）
2. iOS App 回前景 → console log 立刻或最遲 30 秒內出現 polling
3. Web tab 切走 → DevTools Network 看不到新 polling request
4. Web tab 切回 → 立刻或最遲 30 秒內出現 polling

- [ ] **Step 7.4: B2 — ETag 短路**

1. 開 dev server log（terminal 看 next dev 那邊的輸出）
2. 觀察至少 1 分鐘
3. 多數請求應該回 304；server log 也只 log 304 對應路徑
4. 改一個 task → 下一次 polling 應該回 200 + body
5. DevTools Network：304 response size < 200 byte

- [ ] **Step 7.5: 等使用者回報**

OK → Task 8。有問題 → 修對應 task 重做。

---

## Task 8: 分區 commit

依主題分組（commit message 主旨+body 用繁體中文）。

- [ ] **Step 8.1: Commit B1 — 編輯器 selection mapping fix**

```bash
cd /Users/mike/Documents/nudge && git add src/components/editor/split-task-list.ts && git commit -m "$(cat <<'EOF'
fix(web/editor): SplitTaskList appendTransaction 補 selection mapping

TipTap 的 ProseMirror selection 在 doc 改寫後不會自動跟著 tr.mapping
走，必須手動 map 一次。原本 appendTransaction 把 task list 拆開後
直接 return tr，selection 用舊 position mapping 到新 doc 落到不預期
位置 — 表現為「建 checkbox 後 cursor 跳到下方」「勾選 checkbox 後 row
視覺位置抖動」，間歇出現（取決於 cursor 是否落在被改寫範圍內）。

修法：return 前補 tr.setSelection(newState.selection.map(tr.doc, tr.mapping)).

EOF
)"
```

- [ ] **Step 8.2: Commit B2 — Server ETag + 304**

```bash
git add src/app/api/daily/\[date\]/route.ts && git commit -m "$(cat <<'EOF'
feat(api/daily): /api/daily/[date] 加 ETag + 304 短路

For Smart Polling：client 30s polling 多數請求回 304（payload 幾 byte），
真有變動才送 full body。

ETag = W/md5(date|maxUpdatedAt|assignmentsCount|overdueCount). Weak
ETag 因為等價值就好，不需 byte-wise 一致。Cache-Control: no-cache 告訴
瀏覽器每次都驗證、配合 ETag 走標準 HTTP 304 流程。

只先做 dailyData endpoint（最常用、最大同步痛點）；其他 endpoint
（cards list / notes feed / week summary）視需求 v2 再加。

EOF
)"
```

- [ ] **Step 8.3: Commit B2 — Web SWR refreshInterval**

```bash
git add src/hooks/use-daily.ts && git commit -m "$(cat <<'EOF'
feat(web/daily): SWR refreshInterval 30s + 暫停在 hidden / offline

useDaily 加 refreshInterval: 30000、refreshWhenHidden: false、
refreshWhenOffline: false。SWR 透過 fetch 走瀏覽器 HTTP cache，server
回 304 時瀏覽器自動還 cached body、SWR 比對「資料一樣」不重 render。

效果：visible tab 30 秒內看到 iOS / 其他 tab 改的任務；切走 / 沒網路
自動暫停。

EOF
)"
```

- [ ] **Step 8.4: Commit B2 — iOS APIClient ETag + TaskRepository + DailyHostView polling**

```bash
git add apple/NudgeKit/Sources/NudgeCore/APIError.swift apple/NudgeKit/Sources/NudgeCore/APIClient.swift apple/NudgeKit/Sources/NudgeData/TaskRepository.swift apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift && git commit -m "$(cat <<'EOF'
feat(apple/sync): iOS 30s polling + APIClient ETag 短路

三層改動串成 iOS 端的 smart polling：

- APIError 加 .notModified case
- APIClient 加 etagCache（NSLock + nonisolated(unsafe) dict 同既有
  pattern）。GET request 帶 If-None-Match；304 throw .notModified；
  200 從 response header 抓 ETag 存 cache（key 用 request.url?.path）
- TaskRepository.refreshIfChanged(date:) — polling-friendly 版本，
  接住 .notModified 當 no-op；其他錯誤同 dailyData 路徑（log + 忽略）
- DailyHostView 起 Task loop 每 30s call refreshIfChanged。
  scenePhase .active 啟動、其他 phase / onDisappear cancel；onAppear
  也手動 start 一次（scenePhase 第一次 active 不會 fire onChange）

效果：App 在前景 30 秒內反映 web / 其他裝置改的任務；同時 widget 透過
TaskRepository.dailyData 路徑寫 snapshot.json 也跟著更新。

EOF
)"
```

- [ ] **Step 8.5: 確認 git 乾淨**

```bash
git status && git log --oneline -8
```

預期：`nothing to commit, working tree clean` + 看到 4 個新 commits。

- [ ] **Step 8.6: Push 到 origin**

```bash
git push origin feat/ios-tiptap-editor 2>&1 | tail -3
```

---

## Self-Review

**Spec coverage：**
- §B1 → Task 1（selection mapping fix） ✓
- §B2 Server ETag + 304 → Task 2 ✓
- §B2 Web SWR → Task 3 ✓
- §B2 iOS APIClient ETag → Task 4 ✓
- §B2 iOS TaskRepository.refreshIfChanged → Task 5 ✓
- §B2 iOS DailyHostView polling Task → Task 6 ✓
- §B2 Widget 被動受惠 → 涵蓋於 Task 5 (refreshIfChanged 內呼叫 widgetRefresher) ✓
- §測試計畫 B1 + B2 → Task 7 ✓

**Placeholder scan：**
- Step 2.1 內「`note?.updatedAt` — 看 schema 確認」是條件分支，提供具體 fallback（`note.content.length`），不算 placeholder。
- Step 6.1 內「先 grep 確認」是務實的環境檢查，不是延遲決策。

無 TBD / TODO / "implement later"。

**Type consistency：**
- `APIError.notModified` 在 Task 4.1 定義、Task 5.1 接住、Task 4.4 throw — 名稱一致。
- `refreshIfChanged(date:)` signature 在 Task 5.1 定義、Task 6.3 呼叫 — 一致。
- `cachedETag` / `storeETag` 在 Task 4.2 定義、Task 4.3 / 4.4 呼叫 — 一致。
- `pollingTask` 在 Task 6.1 定義、6.2 + 6.3 操作 — 一致。

無不一致。

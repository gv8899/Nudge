# Swift Phase 4：卡片（Cards）Design

**Date:** 2026-04-17
**Scope:** iOS + macOS (同一 SwiftUI codebase，兩個 target)
**Parent:** 延續 Phase 0–2 的 NudgeKit（`NudgeCore` / `NudgeData` / `NudgeUI`）

---

## 目標

讓使用者在手機 / Mac 上**翻閱、搜尋、建立卡片**，卡片標題可直接編輯。描述內容（Quill/Tiptap rich-text HTML）先以純文字預覽呈現，rich-text 編輯器留到獨立 phase。

「卡片」= Web `tasks` 表中 `description` 非空、`status != archived` 的 task。Web 已把這些叫 Card；Swift 沿用。

---

## 範圍

### 做
- 卡片列表（搜尋 / 無限捲動 / tag badges / 預覽）
- 卡片 detail（標題 inline 編輯、描述純文字顯示、tags 只讀）
- 新增卡片（POST 空白 → 導向 detail → 自動 focus 標題）
- iOS：NavigationStack push；macOS：NavigationSplitView 左 list、右 detail

### 不做（明文）
- **rich-text 編輯**：description 純文字預覽；要編要回 Web。留到後續 phase。
- **刪除卡片**：用 Web 的 archive 流程。
- **「清除 untitled」批次刪**：Web 功能。
- **Tag picker**：只顯示，不改。
- **Grid view toggle**：iOS 手機用 grid 擠；macOS 本身就 split-pane，grid 沒必要。一律 list。
- **離線瀏覽 / SwiftData cache**：cards 是瀏覽型，network-first；離線顯 error banner + retry。

---

## 使用者流程

### 新增卡片
1. 使用者在卡片 list 右上點 `+`
2. `CardRepository.create()` → `POST /api/tasks` body `{title:"", description:"<p></p>", status:"inbox"}` → 回傳新 task
3. 導向 `CardDetailView` 帶 new id
4. 標題 `TextField` 自動 `.focused(true)`
5. 使用者輸入標題；`onChange` 500ms debounce → `PATCH /api/tasks/{id}`
6. 使用者按 `<` back / 關閉 sheet → 回列表
7. 列表下次 refresh（pull-to-refresh 或進入頁）時該卡片出現在最前

### 搜尋
1. 使用者在搜尋框 type
2. 300ms debounce 後 → `GET /api/cards?q=<query>&limit=20`
3. 清空 query 後恢復全量列表

### 無限捲動
1. 最後一張 row `.onAppear`
2. 如果 `hasMore` 且沒在 loading → 帶 last card 的 `updatedAt` 當 cursor 再打 `GET /api/cards?cursor=...&limit=20`
3. append 到 list

---

## 資料層 (NudgeCore)

### DTO

```swift
public struct CardDTO: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let title: String
    public let description: String      // server 可能回 null / "" / HTML string
    public let updatedAt: Date
    public let tags: [TagDTO]
}

public struct CardListDTO: Codable, Sendable {
    public let cards: [CardDTO]
    public let nextCursor: String?       // ISO date; nil = 最後一頁
}
```

TaskDTO decode null description 的 pattern（Phase 2 已做）沿用到 CardDTO。

### Repository

```swift
@Observable @MainActor
public final class CardRepository {
    public init(client: APIClient)

    public func list(query: String, cursor: String?, limit: Int = 20) async throws -> CardListDTO
    public func create() async throws -> CardDTO            // POST empty → new Card
    public func refresh(query: String) async throws -> CardListDTO   // cursor = nil
    // 標題 / 描述更新沿用 Phase 2 的 TaskRepository.updateTitle / updateDescription
}
```

**不寫 SwiftData cache**。Cards 是瀏覽型；list 的分頁結果記憶體中即可（由 view 層管）。離線時顯錯誤 banner，沒有假裝還有資料。

### 新 i18n key
抄 Web `cards.*` / `cardDetail.*` 既有 key，**不新增**。需要 mirror 到 `Localizable.xcstrings`：
- `cards.searchPlaceholder`
- `cards.searchAria`
- `cards.emptyNoCards`
- `cards.emptyWithQuery`
- `cards.loadMore`
- `cards.noMore`
- `cards.createAria`
- `cardDetail.editTitleAria`
- `cardDetail.editorPlaceholder`

如果 Web 沒的要補到 Web 再 mirror。

---

## UI 層 (NudgeUI/Cards/)

### `CardsHostView`
頂層 view，iOS 與 macOS 分歧：

**iOS**
- `NavigationStack(path:)`
- 標題「卡片」 + `+` toolbar button (right)
- 搜尋框（下方或 `.searchable` navigation）
- List of `CardListItemView`
- `navigationDestination(for: CardDTO.self)` → `CardDetailView`

**macOS**
- `NavigationSplitView`
  - Sidebar: 卡片列表（300pt 寬，對齊 Daily 的 calendar pane）
  - Detail: `CardDetailView(card:)` 或空態 "選擇一張卡片"
- Toolbar `+` button 放在 sidebar toolbar

### `CardListItemView`
```
[標題單行 truncate]                     M/d
[內文預覽 2 行 stripped HTML]
[tag chips…]
```
- `NudgeCheckbox` / `IconButton` 這類 component 不適用（row 本身是 Link/Button）
- 整個 row `onTapGesture` 導向 detail
- `.contentShape(Rectangle())` 讓整列可點

### `CardDetailView`
- iOS：背景 `Color.nudgeBackground`，`ScrollView` 包：
  - `TextField("cardDetail.editTitleAria", text: $title)` — `.font(.title2.weight(.semibold))`、`.onChange(of: title)` 500ms debounce → `onUpdateTitle`
  - `Divider` (`Color.nudgeBorderLight`)
  - `Text(description.strippedHTML)` — 純文字、讀不能編
  - `Tag chips` horizontally scroll
- `.navigationTitle(card.title)` 跟 TextField 聯動（edit 時顯 placeholder）
- 首次進入且 title 空 → `@FocusState` 自動 focus（新建卡片自然進入編輯）

### `CardsHostView.loadMore` 行為
- `@State cards: [CardDTO]`、`@State nextCursor: String?`、`@State isLoading: Bool`
- `.onAppear` of last cell：
  ```swift
  if !isLoading, let cursor = nextCursor {
      await loadMore()
  }
  ```
- 防抖：load more 期間 `isLoading = true` 避免重複觸發

### HTML strip helper
在 `NudgeCore/StringHTML.swift`：
```swift
public extension String {
    /// Removes HTML tags and collapses whitespace. Not a full parser;
    /// matches Web's lib/strip-html.ts behaviour.
    func strippedHTML(maxLength: Int? = nil) -> String
}
```

使用 `NSAttributedString(data:options:documentAttributes:)` with `.html` 做完整 decode 太重且行為不一致；改用 regex `<[^>]+>` 取代成空字串 + collapse whitespace，對 Quill/Tiptap 輸出夠用。

---

## API 對應

| Action | Method + Path | Body / Query | Response |
|---|---|---|---|
| List | `GET /api/cards` | `q`, `cursor`, `limit` | `{cards:[], nextCursor?}` |
| Create | `POST /api/tasks` | `{title:"", description:"<p></p>", status:"inbox"}` | 新 `task` 物件 |
| Update title | `PATCH /api/tasks/{id}` | `{title}` | `{}` |
| Get detail | `GET /api/tasks/{id}` | — | full task (Phase 2 `TaskDTO` 涵蓋；cards 需 `description` + `tags`) |

**Response shape（已驗證）**：
- `GET /api/cards` 每筆含 `tags: [{id, name, color}]`
- `GET /api/tasks/{id}` 回 raw task row — **不含 tags**

**決策**：List view 把完整 `CardDTO`（含 tags）傳進 detail view，detail 不再打 `GET /api/tasks/{id}`。只有新增卡片後的空白 detail 才會沒 `CardDTO` — 這種情況 tags 本來就為空。Detail 內容用 `@State` copy 做本地編輯；save 透過 PATCH 送出；list refresh 時拿新結果覆蓋。

---

## 錯誤處理

| 情境 | 行為 |
|---|---|
| Network fail on list | Empty state → `error.network` + 重試按鈕 |
| Network fail on create | Toast / banner "建立失敗，請重試"；沒導向 detail |
| Network fail on title save | 保留 local title，顯示 warning icon 旁邊（後續 re-try） |
| 401 | 走 Phase 1 的 `setUnauthorizedHandler` → auth 強制登出 |
| 500 / decode fail | 顯 generic error，保持 cards 列表不清空 |

與 Phase 2 一致：`do/catch + print` 不用 `try?` 吞錯。

---

## 測試

- `CardDTOTests` — decode real server payload（含 `description: null`、含 tag array）
- `CardRepositoryTests` — `list(query:)` 有 `q=` query string、`list(cursor:)` 有 `cursor=` query string、`create()` POST `/api/tasks` body 對
- `CardsHostViewStateTests`（可選）— 搜尋 debounce、loadMore 防抖不重複 fetch
- UI 層靠 Xcode simulator 手動驗；Phase 2 已確立模式

---

## 平台整合

- `PlatformRootView.swift` iOS tab「卡片」從 `PlaceholderTab` 換成 `CardsHostView()`
- `PlatformRootView.swift` macOS sidebar `.cards` case 同上
- `NudgeiOSApp` / `NudgeMacApp` 在 init 建 `CardRepository(client:)` 並 `.environment()` 注入

---

## Definition of Done

- `swift test --no-parallel` 全綠（含 CardDTOTests / CardRepositoryTests）
- `xcodebuild -scheme Nudge-iOS` 綠
- iOS 模擬器手動：列表載入 → 搜尋 → 捲到底觸發 load more → 點一張卡進 detail → 改標題 → 500ms 後 PATCH 送出 → back → list 看到更新 → 按 `+` 新增空白 → 自動進 detail + focus 標題 → 輸入標題 → back → list 第一張就是新建的
- macOS 手動驗：split view 兩邊正確、sidebar `+` 可用
- pre-commit hook 不擋（`Color.nudgeXxx` 全用對）
- 三語切換（zh-Hant / en / ja）所有 UI 文字正確

---

## Phase 4 不包含（可能之後獨立 phase）

- rich-text 編輯器（WKWebView + Quill/Tiptap bridge）→ 叫 Phase 4b 或併 Phase 3 notes
- Tag picker（detail 可改 tag）→ Phase 5
- Archive / delete card → Phase 5
- 卡片分類 / collection → 未規劃

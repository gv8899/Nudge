# Mac 卡片區搜尋 + Tag Filter 設計

日期：2026-06-07
範圍：僅 macOS（`apple/`）。iOS 不動。

## 目標

讓 macOS Cards tab（`CardsHostView` 的 `macOSLayout`）具備卡片搜尋與 tag 篩選能力。
目前該畫面只是「全部卡片」的無篩選 grid（Mail-style split detail）。

## 背景與既有實作（對齊基準）

同平台已有可對齊的範本，**不另起一套 UX**：

- **macOS Daily 右側 dashboard cards 面板**（`DailyHostView`）：自刻 search field
  （`magnifyingglass` + `TextField` + `xmark.circle.fill` clear）＋ `FlowLayout` tag chips
  （capsule，selected = `nudgePrimary`）＋ clear 鈕。邏輯：`query` → `debouncedQuery`
  （300ms）→ `selectedTagIds: Set` → `searchKey = "query|sortedTags"` → `.task(id:)`
  觸發 fetch；filtering 時顯示搜尋結果、否則顯示最近卡片快取。
- **iOS `CardSearchView`**：獨立 search tab，`.searchable` + 底部 tag chip panel，邏輯同上。
- **Repo / 後端皆已就緒**：`CardRepository.list(query:cursor:tagIds:limit:)` 支援文字 query
  與 tagIds（AND 語意）。`/api/cards` 固定 `desc(updatedAt)` 排序、cursor 分頁。

決策結論（與使用者確認）：

1. Mac Cards 搜尋 **對齊 Daily dashboard 的 inline 做法**，並把 search field / tag chips
   **抽成共用元件**兩邊共用。
2. **v1 不做排序**（Daily / iOS 皆未做；預設「最新在前」已是後端行為）。無後端變更。
3. Cards tab 的 search bar **常駐顯示**（不用 Daily 的放大鏡 toggle；Cards tab 全寬空間足夠，
   常駐更易發現）。

## 設計

### 1. 共用元件（presentation 層，無業務狀態）

新檔：`apple/NudgeKit/Sources/NudgeUI/Cards/CardSearchComponents.swift`

- **`CardSearchField`**
  - 介面：`query: Binding<String>`、`isFocused: FocusState<Bool>.Binding`、
    `placeholderKey: LocalizedStringKey`（預設 `"cards.searchPlaceholder"`）。
  - 視覺照搬 `DailyHostView.dashboardCardsSearchField`：放大鏡 icon + plain `TextField`
    （tint `nudgePrimary`）+ 非空時顯示 `xmark.circle.fill` clear 鈕，外層圓角 8 的
    `nudgeForeground.opacity(0.06)` 底。
- **`CardTagChips`**
  - 介面：`allTags: [TagDTO]`、`selectedTagIds: Binding<Set<String>>`。
  - 視覺照搬 `DailyHostView.dashboardCardsTagChips`：`FlowLayout(spacing:6, lineSpacing:10)`
    capsule chips，active = `nudgePrimary` 底 / `nudgePrimaryForeground` 字，inactive =
    `nudgeForeground.opacity(0.06)`；有選取時尾端顯示 `common.clear` 鈕。

兩者皆純展示元件；debounce / fetch / 業務狀態留在各 host。色彩全部走既有 token，無硬編碼。

### 2. Daily dashboard 改用共用元件（重構，行為不變）

`DailyHostView` 把 inline 的 `dashboardCardsSearchField`、`dashboardCardsTagChips`
兩段 UI 換成呼叫 `CardSearchField` / `CardTagChips`。

- **所有 @State、`debounceDashboardCardSearch`、`fetchDashboardCardSearch`、`searchKey`、
  toggle/focus 邏輯一律不動**，只替換 UI 渲染。目的：視覺與程式碼收斂成一份，回歸風險最小。

### 3. `CardsHostView` macOS 加搜尋（核心）

新增 macOS-only @State（命名與 Daily 對稱）：
`query` / `debouncedQuery` / `selectedTagIds: Set<String>` / `allTags: [TagDTO]` /
`searchResults: [CardDTO]` / `searchIsLoading` / `hasSearched`，以及 `@FocusState searchFocused`。

- **版面**：`macOSLayout` 的 list 欄（`centeredList` 內 `content` 上方）常駐：
  `CardSearchField` ＋（`allTags` 非空時）`CardTagChips`。常駐、無 toggle。
- **資料源切換**：
  - `isFiltering = !debouncedQuery.isEmpty || !selectedTagIds.isEmpty`
  - `displayedCards = isFiltering ? searchResults : cards`
  - grid（`macGrid`）改吃 `displayedCards`。
- **分頁**：
  - 非 filtering：維持現有「全部卡片 + `loadMore` cursor 分頁」。
  - filtering：用 `searchResults` 第一頁，**不 `loadMore`**（與 Daily / iOS 一致）。
  - `macGrid` 內 `onAppear → loadMore` 的觸發 **僅在非 filtering 時**生效。
- **empty state**（`content`）：
  - filtering 且 `hasSearched` 且結果空 → `cards.emptyWithQuery`（放大鏡 icon）。
  - 否則維持現有 `cards.emptyNoCards`。
- **搜尋觸發**：新增 `.task(id: query)` debounce（300ms）＋ `.task(id: searchKey)` fetch，
  helper 照抄 Daily（`debounce…` / `fetch…` / `loadAllTags`）。
- **split detail 不受影響**：點搜尋結果照常 `openDetail(card)` → `selectedCard = card`，
  右側 detail 照舊；`.id(card.id)` 重灌邏輯不變。

### 4. 範圍界線

- **只動 macOS**。iOS 的 `CardsHostView.iOSLayout` 與既有 `CardSearchView` 完全不碰。
- 共用元件跨平台可編譯，但只在 macOS 兩處使用（沿用既有 `#if os(macOS)` gate 寫法）。
- **i18n**：複用既有 key（`cards.searchPlaceholder` / `cards.emptyWithQuery` / `common.clear`），
  **無新增 key** → 不動 `i18n/canonical` 或 xcstrings。
- **無後端、無排序、無 schema/migration 變更。**

## 測試 / 完成定義

- 本功能為 UI wiring，沿用 Daily 已驗證的 debounce/fetch pattern，無新增獨立純邏輯函式，
  故不新增 vitest / 單元測試（符合專案「純邏輯才測」慣例）。
- 完成定義（AGENTS.md）：
  - `xcodebuild -scheme Nudge-macOS … build` 通過，且 `xcodebuild -scheme Nudge-iOS … build`
    通過（確認共用元件未破 iOS）。
  - macOS 實測逐項：輸入關鍵字過濾 → 選/清 tag → 清空 query 回全列表 → 點搜尋結果開 split
    detail → 切到別的 sidebar 再切回 Cards，搜尋狀態保留（host 在 ZStack 常駐 mount）。
  - 確認 Daily dashboard 重構後搜尋/篩選行為與改前一致（回歸）。

## 風險 / 注意

- **toolbar Fix-D 不受影響**：本案不新增任何 macOS toolbar item，搜尋全部在 host content 內，
  不碰 `rootToolbar` / `cardsToolbar`，因此與 Fix-D 的 NSToolbar 快取問題無交集。
- **重複 tag 載入**：Cards host 與 Daily host 各自 `tagRepo.list()` 一次（5 host 於 sidebar
  ZStack 同時 mount）。與現況一致、無害，不在本案處理。
- 重構 Daily 的兩段 UI 時，務必保持 `@FocusState`（toggle 關閉時 defocus）行為不變。

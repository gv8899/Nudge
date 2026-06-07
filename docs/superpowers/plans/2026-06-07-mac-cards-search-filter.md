# Mac 卡片區搜尋 + Tag Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 macOS Cards tab（`CardsHostView`）具備常駐搜尋框 + tag 篩選，對齊 Daily dashboard 既有實作。

**Architecture:** 把 Daily dashboard 的 inline search field / tag chips 抽成共用元件 `CardSearchField` / `CardTagChips`；Daily 改用元件（行為不變），`CardsHostView` macOS 端新增搜尋狀態 + 常駐 search bar，filtering 時以搜尋結果取代分頁全列表。僅動 macOS。

**Tech Stack:** SwiftUI（`apple/NudgeKit` / NudgeUI module）、既有 `CardRepository.list(query:cursor:tagIds:)`、`TagRepository.list()`。

> **測試策略**：本案為 SwiftUI UI wiring，沿用 Daily 已驗證的 debounce/fetch pattern，無新增獨立純邏輯函式。依專案慣例（AGENTS.md「純邏輯才測」）不新增 XCTest/vitest。每個 Task 的驗證 = `xcodebuild` 編譯通過；最終 Task 走完整手動實測清單。

**前置**：所有 `xcodebuild` 前若 `apple/Nudge.xcodeproj` 不存在或改過 `project.yml`，先跑 `cd /Users/mike/Projects/nudge/apple && xcodegen generate`（`.xcodeproj` 不進 git）。

常用 build 指令（後續 Task 直接引用）：

```bash
# macOS build
xcodebuild -project /Users/mike/Projects/nudge/apple/Nudge.xcodeproj \
  -scheme Nudge-macOS -destination 'platform=macOS' build
# iOS build（確認共用元件未破 iOS）
xcodebuild -project /Users/mike/Projects/nudge/apple/Nudge.xcodeproj \
  -scheme Nudge-iOS -destination 'generic/platform=iOS Simulator' build
```

---

### Task 1: 建立共用元件 `CardSearchField` + `CardTagChips`

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Cards/CardSearchComponents.swift`

- [ ] **Step 1: 建立元件檔**

照搬 Daily dashboard 的視覺與 token，參數化為兩個純展示元件。色彩全走既有 `Color.nudgeXxx` token，無硬編碼。

```swift
import SwiftUI
import NudgeCore

/// 共用卡片搜尋輸入框。視覺/行為抽自 `DailyHostView` 的 dashboard cards
/// 搜尋面板 —— macOS Cards tab 與 Daily 右側 dashboard 共用同一份，避免
/// 在同一個 app 裡出現兩種卡片搜尋外觀。
///
/// 純展示：query 綁定與 focus 由呼叫端持有；容器外距 / auto-focus 等
/// 行為留在呼叫端（Daily 展開時要 auto-focus、Cards tab 常駐不需要）。
struct CardSearchField: View {
    @Binding var query: String
    var isFocused: FocusState<Bool>.Binding
    let placeholderKey: LocalizedStringKey

    init(
        query: Binding<String>,
        isFocused: FocusState<Bool>.Binding,
        placeholderKey: LocalizedStringKey = "cards.searchPlaceholder"
    ) {
        self._query = query
        self.isFocused = isFocused
        self.placeholderKey = placeholderKey
    }

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .nudgeFont(.fieldIcon)
                .foregroundStyle(Color.nudgeTextDim)
            TextField("", text: $query, prompt: Text(placeholderKey, bundle: .module))
                .textFieldStyle(.plain)
                .nudgeFont(.fieldText)
                .foregroundStyle(Color.nudgeForeground)
                .tint(Color.nudgePrimary)
                .focused(isFocused)
            if !query.isEmpty {
                Button { query = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .nudgeFont(.fieldIcon)
                        .foregroundStyle(Color.nudgeTextDim)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.nudgeForeground.opacity(0.06))
        )
    }
}

/// 共用 tag 多選 chips（`FlowLayout` 折行，capsule，active = `nudgePrimary`）。
/// 視覺抽自 `DailyHostView.dashboardCardsTagChips`。容器外距留呼叫端。
struct CardTagChips: View {
    let allTags: [TagDTO]
    @Binding var selectedTagIds: Set<String>

    init(allTags: [TagDTO], selectedTagIds: Binding<Set<String>>) {
        self.allTags = allTags
        self._selectedTagIds = selectedTagIds
    }

    var body: some View {
        FlowLayout(spacing: 6, lineSpacing: 10) {
            ForEach(allTags) { tag in
                let active = selectedTagIds.contains(tag.id)
                Button {
                    if active {
                        selectedTagIds.remove(tag.id)
                    } else {
                        selectedTagIds.insert(tag.id)
                    }
                } label: {
                    Text(verbatim: tag.name)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(active ? Color.nudgePrimaryForeground : Color.nudgeForeground)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(active ? Color.nudgePrimary : Color.nudgeForeground.opacity(0.06))
                        )
                }
                .buttonStyle(.plain)
            }
            if !selectedTagIds.isEmpty {
                Button { selectedTagIds.removeAll() } label: {
                    HStack(spacing: 3) {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .medium))
                        Text("common.clear", bundle: .module)
                            .font(.system(size: 13, weight: .medium))
                    }
                    .foregroundStyle(Color.nudgePrimary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
            }
        }
    }
}
```

- [ ] **Step 2: 編譯驗證（macOS）**

Run（前置：必要時先 `xcodegen generate`）：
```bash
xcodebuild -project /Users/mike/Projects/nudge/apple/Nudge.xcodeproj \
  -scheme Nudge-macOS -destination 'platform=macOS' build
```
Expected: `BUILD SUCCEEDED`。若報 `nudgeFont` / `FlowLayout` / `TagDTO` 找不到，確認 import 與型別（`FlowLayout`、`TagDTO`、`nudgeFont` 皆已存在於 NudgeUI / NudgeCore）。

- [ ] **Step 3: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeUI/Cards/CardSearchComponents.swift
git commit -m "feat(apple/cards): 抽 CardSearchField / CardTagChips 共用元件

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Daily dashboard 改用共用元件（重構，行為不變）

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift`（`dashboardCardsSearchField` ~850-887、`dashboardCardsTagChips` ~889-940）

只替換這兩段的 UI 渲染，**所有 @State / `debounceDashboardCardSearch` / `fetchDashboardCardSearch` / `dashboardCardSearchKey` / focus / toggle 邏輯一律不動**。

- [ ] **Step 1: 替換 `dashboardCardsSearchField`**

把整個 `private var dashboardCardsSearchField: some View { ... }`（含內部 HStack / TextField / clear 鈕 / background / 外距 / `.onAppear`）替換為：

```swift
    private var dashboardCardsSearchField: some View {
        CardSearchField(
            query: $dashboardCardSearchQuery,
            isFocused: $dashboardCardSearchFieldFocused
        )
        // 容器外距與 auto-focus 留在呼叫端（元件只負責 field 本體）。
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
        .onAppear { dashboardCardSearchFieldFocused = true }
    }
```

- [ ] **Step 2: 替換 `dashboardCardsTagChips`**

把整個 `private var dashboardCardsTagChips: some View { ... }`（含 FlowLayout / chips / clear 鈕 / 外距）替換為：

```swift
    private var dashboardCardsTagChips: some View {
        CardTagChips(
            allTags: dashboardCardAllTags,
            selectedTagIds: $dashboardCardSelectedTagIds
        )
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }
```

- [ ] **Step 3: 編譯驗證（macOS）**

Run:
```bash
xcodebuild -project /Users/mike/Projects/nudge/apple/Nudge.xcodeproj \
  -scheme Nudge-macOS -destination 'platform=macOS' build
```
Expected: `BUILD SUCCEEDED`。

- [ ] **Step 4: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift
git commit -m "refactor(apple/daily): dashboard 卡片搜尋改用 CardSearchField / CardTagChips

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> 行為驗證（Daily dashboard 搜尋/篩選與改前一致）併入 Task 4 手動實測。

---

### Task 3: `CardsHostView` macOS 加常駐搜尋 + tag filter

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Cards/CardsHostView.swift`

改動點：(a) 新增 macOS 搜尋 @State；(b) `centeredList` 上方插常駐 search bar；(c) `content` 改平台分流，macOS 走 filtering-aware empty/grid；(d) `macGrid` 吃 `displayedCards` 且 `loadMore` 僅非 filtering 觸發；(e) core 加 `.task`；(f) 新增 helper。

- [ ] **Step 1: 新增 macOS 搜尋 @State**

在現有 `#if os(macOS)` 的 `selectedCard` 宣告（~line 31-35）之後，補上：

```swift
    /// 搜尋 / tag 篩選狀態（macOS Cards tab 常駐 search bar）。命名與
    /// DailyHostView 的 dashboard 卡片搜尋對稱。
    @State private var searchQuery = ""
    @State private var debouncedQuery = ""
    @State private var selectedTagIds: Set<String> = []
    @State private var allTags: [TagDTO] = []
    @State private var searchResults: [CardDTO] = []
    @State private var searchIsLoading = false
    @State private var hasSearched = false
    @FocusState private var searchFocused: Bool
```

- [ ] **Step 2: `centeredList` 插入常駐 search bar**

把 `centeredList`（~line 180-186）替換為（在 content 上方加 `searchBar`，整欄仍受 `listColumnWidth` 置中）：

```swift
    private var centeredList: some View {
        HStack(spacing: 0) {
            Spacer(minLength: 0)
            VStack(spacing: 0) {
                searchBar
                content
            }
            .frame(maxWidth: Self.listColumnWidth)
            Spacer(minLength: 0)
        }
    }

    /// Cards tab 常駐搜尋列：search field +（有 tag 時）tag chips。
    /// 與 Daily dashboard 不同，這裡不收合（全寬空間足夠、常駐更易發現）。
    private var searchBar: some View {
        VStack(spacing: 10) {
            CardSearchField(query: $searchQuery, isFocused: $searchFocused)
            if !allTags.isEmpty {
                CardTagChips(allTags: allTags, selectedTagIds: $selectedTagIds)
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }
```

- [ ] **Step 3: `content` 改平台分流 + 新增 `macContentBody`；移除舊 `list`**

把現有 `content`（~line 230-260）與 `list`（~line 262-274）整段替換為：

```swift
    @ViewBuilder
    private var content: some View {
        #if os(macOS)
        macContentBody
        #else
        iOSContentBody
        #endif
    }

    #if os(iOS)
    /// iOS 維持原本「全部卡片」清單（iOS 搜尋走獨立 CardSearchView tab）。
    @ViewBuilder
    private var iOSContentBody: some View {
        if cards.isEmpty && isLoading {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if cards.isEmpty && hasError {
            ContentUnavailableView {
                Label {
                    Text("error.unknown", bundle: .module)
                } icon: {
                    Image(systemName: "exclamationmark.triangle")
                }
            }
        } else if cards.isEmpty {
            ContentUnavailableView {
                Label {
                    Text("cards.emptyNoCards", bundle: .module)
                } icon: {
                    Image(systemName: "square.stack")
                }
            } description: {
                Text("cards.emptyDescription", bundle: .module)
            } actions: {
                Button(action: createCard) {
                    Text("cards.createAria", bundle: .module)
                }
            }
        } else {
            ScrollView { iOSList }
        }
    }
    #endif

    #if os(macOS)
    /// macOS：filtering 時顯示搜尋結果、否則顯示全部卡片分頁列表。
    @ViewBuilder
    private var macContentBody: some View {
        if displayedCards.isEmpty {
            if isFiltering {
                if searchIsLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if hasSearched {
                    ContentUnavailableView {
                        Label {
                            Text("cards.emptyWithQuery", bundle: .module)
                        } icon: {
                            Image(systemName: "magnifyingglass")
                        }
                    }
                } else {
                    // 剛開始 filtering、fetch 尚未回 — 撐版避免閃 empty。
                    Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            } else if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if hasError {
                ContentUnavailableView {
                    Label {
                        Text("error.unknown", bundle: .module)
                    } icon: {
                        Image(systemName: "exclamationmark.triangle")
                    }
                }
            } else {
                ContentUnavailableView {
                    Label {
                        Text("cards.emptyNoCards", bundle: .module)
                    } icon: {
                        Image(systemName: "square.stack")
                    }
                } description: {
                    Text("cards.emptyDescription", bundle: .module)
                } actions: {
                    Button(action: createCard) {
                        Text("cards.createAria", bundle: .module)
                    }
                }
            }
        } else {
            ScrollView { macGrid }
        }
    }

    private var isFiltering: Bool {
        !debouncedQuery.isEmpty || !selectedTagIds.isEmpty
    }

    /// filtering → 搜尋結果；否則 → 全部卡片（分頁快取）。
    private var displayedCards: [CardDTO] {
        isFiltering ? searchResults : cards
    }

    /// debouncedQuery + 選中 tag 一起 key — chip 切換也觸發 re-fetch。
    private var searchKey: String {
        let tags = selectedTagIds.sorted().joined(separator: ",")
        return "\(debouncedQuery)|\(tags)"
    }
    #endif
```

- [ ] **Step 4: `macGrid` 改吃 `displayedCards` 並 gate `loadMore`**

把 `macGrid`（~line 283-303）替換為：

```swift
    @ViewBuilder
    private var macGrid: some View {
        LazyVGrid(columns: gridColumns, spacing: 12) {
            ForEach(displayedCards) { card in
                CardGridItemView(
                    card: card,
                    isSelected: selectedCard?.id == card.id,
                    onTap: { openDetail(card) }
                )
                .onAppear {
                    // 分頁只在「全部卡片」模式有意義；filtering 結果只取
                    // 第一頁（與 Daily / iOS CardSearchView 一致），不續抓。
                    if !isFiltering, card.id == cards.last?.id {
                        Task { await loadMore() }
                    }
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)

        if !isFiltering {
            paginationFooter
        }
    }
```

- [ ] **Step 5: macOS core 加搜尋 `.task`**

在 `macOSLayout` 的 `core`（~line 159 的 `.task { await firstPage() }`）後面，補三個 macOS 搜尋 task：

```swift
        .task { await firstPage() }
        .task { await loadAllTags() }
        .task(id: searchQuery) { await debounceSearch() }
        .task(id: searchKey) { await fetchSearch() }
```

- [ ] **Step 6: 新增 helper（macOS-only）**

在 `firstPage()` / `loadMore()` 附近（helper 區），補上 `#if os(macOS)` 包住的三個 helper：

```swift
    #if os(macOS)
    private func loadAllTags() async {
        do {
            allTags = try await tagRepo.list()
        } catch {
            if !APIError.isCancellation(error) {
                print("[CardsHostView] loadAllTags failed: \(error)")
            }
        }
    }

    private func debounceSearch() async {
        try? await Task.sleep(nanoseconds: 300_000_000)
        if !Task.isCancelled {
            debouncedQuery = searchQuery.trimmingCharacters(in: .whitespaces)
        }
    }

    private func fetchSearch() async {
        let q = debouncedQuery
        let tagIds = Array(selectedTagIds)
        guard !q.isEmpty || !tagIds.isEmpty else {
            searchResults = []
            hasSearched = false
            return
        }
        searchIsLoading = true
        do {
            let page = try await cardRepo.list(query: q, cursor: nil, tagIds: tagIds)
            searchResults = page.cards
            hasSearched = true
        } catch {
            if !APIError.isCancellation(error) {
                print("[CardsHostView] fetchSearch failed: \(error)")
                searchResults = []
                hasSearched = true
            }
        }
        searchIsLoading = false
    }
    #endif
```

- [ ] **Step 7: 編譯驗證（macOS + iOS 雙 target）**

Run:
```bash
xcodebuild -project /Users/mike/Projects/nudge/apple/Nudge.xcodeproj \
  -scheme Nudge-macOS -destination 'platform=macOS' build
xcodebuild -project /Users/mike/Projects/nudge/apple/Nudge.xcodeproj \
  -scheme Nudge-iOS -destination 'generic/platform=iOS Simulator' build
```
Expected: 兩個都 `BUILD SUCCEEDED`。iOS 必須過 —— 確認 `macContentBody` / `searchBar` / 搜尋 @State 都正確 gate 在 `#if os(macOS)`，沒洩漏到 iOS。

- [ ] **Step 8: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeUI/Cards/CardsHostView.swift
git commit -m "feat(apple/cards): macOS Cards tab 常駐搜尋 + tag 篩選

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 完整驗證（build 雙 target + 手動實測）

**Files:** 無（驗證）

- [ ] **Step 1: 乾淨 build 雙 target**

必要時先 `cd /Users/mike/Projects/nudge/apple && xcodegen generate`，再跑 Task 3 Step 7 的兩條 `xcodebuild`。Expected: 兩者 `BUILD SUCCEEDED`。

- [ ] **Step 2: macOS 實機/模擬器手動實測（逐項打勾）**

> 依 memory「Mac dev relaunch」：重 build 後用 `open -n <DerivedData 絕對路徑的 Nudge.app>` 強制新 instance，避免 LaunchServices 抓回舊版。

Cards tab：
- [ ] 切到 Cards sidebar → 上方常駐看到 search field + tag chips。
- [ ] 輸入關鍵字 → ~300ms 後 grid 收斂為符合的卡片。
- [ ] 點一個 tag chip → 結果再縮（AND 語意）；再點別的 tag、取消 tag。
- [ ] 點 chips 尾端「清除」→ 回到全部卡片。
- [ ] 清空 query（按 `xmark.circle.fill` 或刪字）→ 回到全部卡片分頁列表。
- [ ] 查無結果時顯示放大鏡 + `cards.emptyWithQuery` 文案。
- [ ] 點搜尋結果卡片 → 右側 split detail 開啟、`X` 可關、編輯標題/內文正常。
- [ ] 非 filtering 時往下捲動 → `loadMore` 續抓（分頁仍運作）；filtering 時不續抓。
- [ ] 切到別的 sidebar（Today/Calendar）再切回 Cards → 搜尋 query / 選中 tag 狀態保留。

Daily dashboard 回歸（Task 2）：
- [ ] Today → 開右側面板切到 Cards → 點放大鏡展開 → search field + chips 外觀與行為跟改版前一致；展開 auto-focus、收合 defocus 正常。

- [ ] **Step 3: 回報**

若全數通過 → 回報完成並提供 PR 選項。若有任一項不過 → 走 `superpowers:systematic-debugging`，修正後重跑本 Task。

---

## Self-Review

- **Spec coverage**：共用元件（Task 1）✓；Daily 改用元件（Task 2）✓；CardsHostView 常駐 search + tag filter + 資料源切換 + 分頁 gate + filtering-aware empty（Task 3）✓；只動 macOS / 不碰 iOS·後端·排序·i18n·toolbar（Task 3 gate + 範圍說明）✓；測試/完成定義（Task 4 build 雙 target + 手動實測）✓。
- **Placeholder scan**：無 TBD/TODO，所有 code step 含完整程式碼。
- **Type consistency**：`CardSearchField(query:isFocused:placeholderKey:)`、`CardTagChips(allTags:selectedTagIds:)`、`displayedCards` / `isFiltering` / `searchKey` / `debounceSearch` / `fetchSearch` / `loadAllTags` 全程一致；`searchResults` / `searchIsLoading` / `hasSearched` / `searchFocused` 命名前後一致。

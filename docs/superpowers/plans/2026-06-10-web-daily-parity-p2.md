# P2 — Web Daily 對齊 Mac 實作計畫（展開版）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web Daily（`/day/[date]`）對齊 Mac DailyHostView 的右側面板與視覺整理。

**Architecture:** 母計畫 `2026-06-10-web-mac-parity.md` Phase 2 的展開。前置：P0 token/字級已進 `feat/web-parity-p0`；**P1 `/calendar` 須先通過使用者瀏覽器實測**（本 phase 會複用其 EventPopover 與 calendar 元件）。branch：`feat/web-daily-parity`（自 parity 分支或 merge 後的 main 切出）。

**參照（Mac 行為基準）：** `apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift`（右面板/搜尋）、`Components/ResizeHandle.swift`、`TaskRowView.swift`、`TaskListView.swift`（completed header）。

**通用守則**：同母計畫（i18n 走 canonical→sync、token 紀律、`npx next build`+vitest+瀏覽器實測、每 task commit）。

---

### Task 2.1: 兩行日期 header

**Files:** Modify `src/components/calendar/date-heading.tsx`（讀現檔後改）；使用處 `daily-view.tsx` 核對。

- 改為兩行 hierarchy：上行 weekday 全名（`.text-date-eyebrow text-text-dim`，date-fns `EEEE` locale-aware）、下行日期（`.text-date-title text-foreground`，zh `M月d日` / en `MMM d, yyyy` / ja `M月d日`，照現有 format 邏輯調整）。保留 ghost-text 寬度穩定 trick（讀現檔理解後保留）。
- 驗證：Daily 頁 header 視覺兩行、切日寬度不跳。

### Task 2.2: 共用 ResizeHandle（web 版）

**Files:** Create `src/components/ui/resize-handle.tsx`

- Props：`{ value: number; onChange: (px: number) => void; min: number; max: number; side?: "left" }`。
- 行為照 Mac `ResizeHandle.swift`：8px 寬透明 hit zone、hover/drag 時顯示 3px 直線（`bg-border-light`，drag 中 `bg-primary`）；pointer events（pointerdown 捕捉、pointermove 算 delta、pointerup 釋放）；`cursor-col-resize`；雙擊重設為預設值（可選，Mac 沒有就不做）。clamp min/max。
- 純前端元件；無測試（互動型）。後續 Notes split（P4）共用。

### Task 2.3: 右側面板 shell（toggle + kind 切換 + 可拖寬）

**Files:** Create `src/components/daily/daily-right-panel.tsx`；Modify `src/components/daily/daily-view.tsx`（現固定 300px CalendarPanel 區塊 + `lg:pr-[356px]` 佈局）。

- 狀態（localStorage）：`daily.web.rightPanelOpen`（bool，預設 false —— 對齊 Mac 預設關）、`daily.web.rightPanelKind`（"calendar" | "cards"）、`daily.web.rightPanelWidth`（280–720，預設 400）。
- Toggle 鈕：Daily 內容 header 列右側（lucide `PanelRight`），開/關面板；開著時旁邊出現 kind palette（calendar/cards 兩顆 icon picker —— 對齊 Mac dailyToolbar 的 palette picker）。
- 面板：固定右側（`lg+` only；`<lg` 維持現狀不顯示）、寬 = state、左緣掛 `ResizeHandle`。kind=calendar → 復用現有 `CalendarPanel` 內容；kind=cards → Task 2.4 的 `DailyCardsPanel`。
- 主欄 padding 由固定 `lg:pr-[356px]` 改為依面板開關/寬度動態（CSS var 或 inline style）。
- 注意：現有「固定 300px calendar panel」的呈現遷入此 shell 後**移除舊實作**，不留兩套。

### Task 2.4: Cards 面板（近期卡 + 搜尋）

**Files:** Create `src/components/daily/daily-cards-panel.tsx`

- 預設：近期卡片 grid（複用 `card-grid-item.tsx`；資料 `GET /api/cards` 第一頁、取 12 張 —— 對齊 Mac dashboardRecentCards）。
- Header 列：「卡片」標題 + 數量 + 放大鏡 toggle（對齊 Mac dashboardCardsHeaderWithSearchToggle：展開變 X、收合保留條件）。
- 展開：搜尋框（300ms debounce）+ tag chips（AND，多選，吃 `GET /api/tags`）；filtering 時 grid 換搜尋結果（`/api/cards?q=&tagIds=` —— 與 cards-feed 同 API）。
- 點卡 → `router.push` 到 `/cards/[id]`（web 慣例 route detail）。
- 空態/loading 照 cards-feed pattern。

### Task 2.5: Task row 整理

**Files:** Modify `src/components/task/task-card.tsx`（+ `overdue-section.tsx` 同步）

- Repeat/Bell badge 從 row 移除（detail modal 內保留資訊）。
- move-to-date 從 `…` menu 升級為 row 上獨立 calendar icon（hover 顯示，同現有 `…` 顯隱規則）；`…` 留 Skip/SetRecurring/SetReminder/Archive。
- 完成任務標題加 `line-through`。

### Task 2.6: 已完成分組 header

**Files:** Modify `src/components/daily/daily-view.tsx`

- 已完成任務集中到「已完成 (N)」可收合段（chevron，預設展開，狀態不持久 —— 對齊 Mac TaskListView.completedHeader）。
- i18n：canonical 加 `daily.completedHeader`（zh：已完成 ({count})；en：Completed ({count})；ja：完了 ({count})）→ sync → en/ja 翻譯。

### Task 2.7: 空態 + 細節

**Files:** `daily-view.tsx`

- 空態加 lucide `Sparkles` icon（`text-text-dim`）+ 既有 `daily.emptyToday` 文案，置中。

### Task 2.8: Task detail 改置中卡 popover

**Files:** Modify `src/components/task/task-detail-modal.tsx`

- 全螢幕 modal → Heptabase 式置中卡：`max-w-[500px] max-h-[80dvh]`、backdrop `bg-background/60 backdrop-blur`、點外/Esc 關、圓角 `rounded-2xl`。內容（標題編輯、編輯器、status）不動。
- 注意 memory「.sheet 換自刻 overlay 會掉隱含行為」同類教訓：z-order、scroll lock、focus trap 由既有 Dialog primitive 提供 —— **改樣式不改 primitive**（仍用 ui/dialog，只改 size/backdrop class）。

### Task 2.9: 收尾驗證

- `npx next build` + `npx vitest run` + lint 無新 error。
- 使用者實測清單：toggle 開關面板（重整保留）、calendar/cards 切換、拖寬（重整保留）、cards 面板搜尋/tag 篩選/點卡跳 detail、兩行 header、row 無 badge + calendar icon、已完成分組收合、空態 sparkles、完成刪除線、detail 置中卡（點外關、focus 正常）、`<lg` 不破版、Daily 原功能（拖序、quick add、overdue）回歸。
- PR `feat/web-daily-parity`。

---

**刻意不做（保留 web 既有優勢）**：inline 改標題、dnd-kit 拖序、quick-add inline form、SWR、context menu。

# iOS Daily 任務 Row 改為 Block 卡片

**日期**：2026-04-26
**範圍**：iOS Daily tab — TaskRowView / OverdueSectionView / TaskListView 視覺重做
**狀態**：Design approved，待寫 implementation plan

---

## Background

iOS Daily tab 現況是扁平的列表 row：checkbox + 標題 + ⋯ menu，row 之間零分隔，靠 spacing 區分。但 Cards / Notes tab 都是「卡片式 block」（每個 item 自帶 RoundedRect 背景 + padding）。Daily 視覺不對齊。

對齊的訴求來自 brand：

- **一致性** — 三個 tab 視覺同 family
- **手感溫度** — 卡片 / 紙質感更接近 paper texture 概念
- **Heptabase 參考** — block-based UI 是該系列的招牌

iOS-only 改動。mac 維持目前的密集扁平 row（mac 是 dense workspace，32pt minHeight + hover；iOS 是觸控版本，56pt 卡片更合手）。

## Goals

1. iOS Daily 任務 row 視覺對齊 Cards / Notes 的 block-style
2. 完成 / 過期 / 今日 三種狀態各有清楚視覺區別
3. 不變動互動：點擊 push、swipeActions、⋯ menu 全保留
4. 不變動 mac 端任何視覺

## Non-Goals

- ❌ 不改 mac TaskRowView（mac 維持扁平 32pt + hover）
- ❌ 不改 row 內容（不加 preview / date / tag — 任務不是卡片）
- ❌ 不改 section header「前幾天的 (3) ▼」「已完成 (3) ▼」(label 不是 content，不需 surface)
- ❌ 不改 WeekStripView / FAB / toolbar / navigation
- ❌ 不影響任務 ↔ 詳細頁的 navigation（push 行為不變）

## Visual Spec

### 一般任務卡片（今日）

```
┌────────────────────────────────────┐
│  □   任務標題                  ⋯  │
└────────────────────────────────────┘
```

- **背景**：`Color.nudgeForeground.opacity(0.04)`
- **形狀**：`RoundedRectangle(cornerRadius: 12, style: .continuous)`
- **內 padding**：14pt 水平 × 14pt 垂直
- **minHeight**：56pt
- **內容**：checkbox + 標題（單行，可截）+ ⋯ menu — 排列跟現在一樣

### 完成任務卡片

```
┌────────────────────────────────────┐
│  ☑   任務標題 (劃線 + dim)     ⋯  │  ← bg 更弱 2%
└────────────────────────────────────┘
```

- **背景**：`Color.nudgeForeground.opacity(0.02)`（一般 4% → 完成 2%）
- 標題維持現在的 strikethrough + `Color.nudgeTextDim`
- 其餘同一般卡片

### 過期任務卡片（OverdueSection 內）

```
┌────────────────────────────────────┐
│  □   任務標題                  ⋯  │  ← bg 帶 warning tint
└────────────────────────────────────┘
```

- **背景**：`Color.nudgeWarning.opacity(0.08)`（試這個強度，如果太亮再降）
- 其餘同一般卡片（card frame、padding、minHeight、內容、互動）

### 卡片之間

- **垂直間距**：8pt（一般跟完成都同樣 8pt gap）
- **水平 margin**：16pt（卡片不貼螢幕邊）

### 整體視覺示意（混合三狀態）

```
   ▼ 前幾天的 (2)                       ← section header (inline label)
┌────────────────────────────────────┐
│  □   過期任務 A                ⋯   │  bg: warning 8%
└────────────────────────────────────┘   ↕ 8
┌────────────────────────────────────┐
│  □   過期任務 B                ⋯   │  bg: warning 8%
└────────────────────────────────────┘

                                          ← 區段間留多一點呼吸
┌────────────────────────────────────┐
│  □   今日任務 X                ⋯   │  bg: foreground 4%
└────────────────────────────────────┘   ↕ 8
┌────────────────────────────────────┐
│  ☑   任務 Y (劃線 dim)         ⋯   │  bg: foreground 2%
└────────────────────────────────────┘

   ▼ 已完成 (3)                        ← collapsible section header
   ...
```

## Behavior（互動）

維持現況（不改）：

- 點擊整個 row → push CardDetail
- swipeActions：左 → 完成 toggle、右 → 封存（destructive）
- ⋯ menu：「移到今天 / 設為重複任務 / 跳過這次 / 設提醒 / 封存」
- contextMenu（長按）保留 iOS 預設行為
- Section headers（Overdue / Completed）collapsible 維持

新增 / 改動：

- 點擊 ripple / press feedback 用 SwiftUI 預設 button press（卡片背景在按下時應微微暗，由 `buttonStyle(.plain)` 自然處理）
- 滑卡片時 swipeActions 把卡片往側邊滑出（iOS 原生行為，不需特別處理）

## File Changes

### `apple/NudgeKit/Sources/NudgeUI/Daily/TaskRowView.swift`

iOS 分支加：
- 計算 background fill：completed → 2%、否則 → 4%
- 包 `RoundedRectangle(cornerRadius: 12, style: .continuous).fill(...)` 取代現有 `Color.nudgeBackground`
- iOS 端 minHeight 56pt（mac 維持 32pt）
- iOS 端 padding 14h × 14v（mac 維持 12h × 32pt frame）

mac 分支維持原狀。

### `apple/NudgeKit/Sources/NudgeUI/Daily/OverdueSectionView.swift`

iOS 分支的 `overdueRow`：
- 同樣的 RoundedRect card 結構
- 背景固定用 `Color.nudgeWarning.opacity(0.08)`（不分 completed — overdue 任務 99% 是未完成）
- minHeight 56pt、padding 14×14

mac 分支維持原狀。

### `apple/NudgeKit/Sources/NudgeUI/Daily/TaskListView.swift`

iOS 分支的 list:
- `LazyVStack(spacing: 8)`（從 0 改 8）
- 加 `.padding(.horizontal, 16)` 讓卡片不貼螢幕邊

mac 分支維持原狀（密集列表）。

## Token / Color Notes

- `nudgeForeground.opacity(0.04)` 在 light mode 是淡灰、dark mode 是淡白 — 兩邊都 OK
- `nudgeWarning.opacity(0.08)` 強度未確認，實作時要在 light + dark 都檢查；過亮就降到 0.06
- 卡片不需要 stroke / border — 背景 fill 已足夠視覺區別

## Edge cases

| 情境 | 處理 |
|---|---|
| 任務太長被截斷 | 維持 lineLimit(1) — task 標題短，截了使用者點進 detail 看 |
| Overdue 區段空 | OverdueSection EmptyView 不顯示，無卡片 |
| 完成且過期 | bg 用 warning 8%（overdue 比 completed 優先 — 過期完成的任務還是「過期」） |
| Section 折疊 | 折疊只藏 row 卡片不藏 header — 維持 |
| Dark mode | foreground/warning token 自動切換對應暗色版本 |
| Dynamic Type 放大 | minHeight 56pt 是下限，內容大會自動撐高 |

## Testing

無自動化（純 visual 改動）。手動 checklist：

- [ ] 一般 row：4% 灰底卡片，標題清晰可讀
- [ ] 完成 row：2% 灰底（更弱）+ 劃線 dim 標題
- [ ] 過期 row：warning tint 卡片明顯不同
- [ ] 過期 + 完成：warning bg 維持
- [ ] 卡片間 8pt gap、外側 16pt margin
- [ ] 點卡片正常 push 到 CardDetail
- [ ] swipeActions 左 → 完成 toggle、右 → 封存正常觸發
- [ ] ⋯ menu 開啟正常
- [ ] Dark / Light mode 都讀得清楚
- [ ] mac 端視覺完全沒變（regression check）

## Open Questions

1. `Color.nudgeWarning.opacity(0.08)` 實際強度可能要視覺微調 — 真的看到不滿意再降到 0.06 / 或 mix 一點 foreground 進去
2. Section 之間是否要更大 gap（例如 Overdue → Today 之間 16pt 而不是 8pt）— 實作時試試看視覺

# Web ↔ Mac Parity — 第二輪（視覺/交互收斂）設計

> 第一輪（P0–P5，`docs/superpowers/plans/2026-06-10-web-mac-parity.md`）已把 web 拉到結構對標。
> 本輪是**對著 9 對截圖（Mac zh-TW vs Web）逐螢幕收斂剩餘的視覺與交互落差**。

**Goal:** 讓 web（桌機瀏覽器、**zh-TW locale**）的觀感與交互貼齊 macOS App。使用者決策：**全部對標 Mac**（含「拿掉 web 比 Mac 多做的功能」）。

**Tech Stack:** Next.js（App Router, `src/`）、Tailwind v4（`@theme inline` token）、SWR、date-fns + next-intl、既有 Radix popover/dialog。**零後端改動**。

---

## 0. 關鍵前提：locale 釐清（縮小範圍）

使用者提供的 **web 截圖跑在英文 locale**，**Mac 截圖是 zh-TW**。經查碼，多個「格式差異」其實是 locale 不同、**不是 bug**：

| 項目 | zh-TW 下 web 現況 | Mac (zh-TW) | 結論 |
| --- | --- | --- | --- |
| Month 標題 | `month-view.tsx:39` 已輸出「2026 年 6 月」 | 2026 年 6 月 | **已對齊，本輪不動** |
| Week 日期標題 | `week-view` `EEEE` → 「星期一 6/8」 | 星期一 6/8 | **已對齊，本輪不動** |
| Tasks 大標日期 | `date-heading.tsx:21` zh-TW → 「6月11日」 | **June 11, 2026**（英文） | **需改**（見批次 2） |

**決策（全輪適用）：以 zh-TW 為對標基準。** 英文 locale 不在本輪保證範圍（不壞即可）。

---

## 1. 範圍：5 批次

每批一條 branch / 一個 PR / 瀏覽器實測後 merge。依視覺衝擊與風險排序。

### 批次 1 — 週列重設計 🎯（視覺衝擊最大）

**檔案：** `src/components/calendar/calendar-nav.tsx`（Tasks 與 Calendar Day 共用）

- **現況：** 膠囊分段條。每日 `flex-col md:flex-row`，桌機呈現「Mon 8」橫排內聯（nav 第 60–93 行），`< >` 與 `Today` 內嵌條中（第 52、96、105 行）。
- **目標（Mac）：** 日曆條 —— 上排星期表頭（Mon…Sun）、下排**大數字日期**、再下面小圓點；選中=**填滿金圓**套在數字上。`< Today >` 移出條外（Mac 在左上 toolbar 區）。
- **要點：**
  - 維持既有 `datesWithTasks` 圓點資料來源（SWR `/api/daily/week`）。
  - 星期表頭固定七欄對齊；選中態用 `--primary` 填滿圓（非整格 rounded-md）。
  - 保留鍵盤/`aria-current`/`aria-label`（第 70–71 行）無障礙屬性。
  - `< > Today` 改放標題列左側（對齊 Mac），不再擠在星期條內。
- **驗收：** Tasks 與 Calendar Day 兩處週列外觀一致；點某日切換正確；有任務的日子圓點正確；選中態為金圓。

### 批次 2 — Tasks 頁對齊

**檔案：** `daily-view.tsx`、`date-heading.tsx`、`task/task-card.tsx`、`task/task-create.tsx`、（新增 FAB 元件）

- **移除頁標題：** `daily-view.tsx:358` 的 `<h1>{tNav("tasks")}</h1>` 拿掉（Mac 無「Tasks」字樣）。右側面板控制列（calendar/cards 切換 + PanelRight）**保留**並右對齊。
- **大標日期改英文（對 Mac）：** `date-heading.tsx`
  - 日期：`MMM d, yyyy`/`M月d日` → **`MMMM d, yyyy`**（zh-TW 也用英文全月，得「June 11, 2026」）。
  - 星期 eyebrow：`EEEE`(localized) → **英文星期**（得「Thursday」，對 Mac）。
  - `GHOST_DATE` 跟著放寬為最長英文（如 `"September 30, 2026"`），避免版面跳動。
- **每列尾端 icon 3→2：** `task-card.tsx`（約第 223 行 `CalendarDays` + `FileText`，232 行 `MoreHorizontal`）
  - 移除 `FileText`（筆記/描述）inline icon，只留 **日曆 + ⋯**（對 Mac）。若 `FileText` 原動作（開描述）無法從 ⋯ 進入，則把它收進 ⋯ 選單，不直接消失。
- **新增任務改 FAB：** 以右下浮動 `+` 按鈕取代頂部 inline `TaskCreate`（`task-create.tsx` / `daily-view.tsx:430`）。
  - FAB 固定右下（對 Mac img1）；點擊 → 聚焦/展開任務輸入（可沿用 `TaskCreate` 的 input，改由 FAB 觸發顯示，而非常駐頂部）。
  - 保留現有 `handleCreateTask` 流程。
- **「From earlier」分組：** `OverdueSection` 已存在且預設展開（`overdue-section.tsx`，資料來自 `data.overdueTasks`）。本輪僅做**樣式微調貼 Mac**（可選、低優先）：Mac 為「From earlier (n)」+ 右側 chevron、無 `CalendarClock` icon；web 現為左 chevron + CalendarClock。對齊到 Mac 版面即可，邏輯不動。
- **驗收：** 無「Tasks」標題；大標顯示「Thursday / June 11, 2026」；每列僅 2 個尾端 icon；右下 FAB 可新增任務並 reload 後仍在；逾期分組正常。

### 批次 3 — Calendar 分段控制位置

**檔案：** `calendar/calendar-host.tsx`

- **現況：** Day/Week/Month segmented 置中（第 95 行 `justify-center`）。
- **目標（Mac）：** 移到**左上角**（`justify-start` + 左內距），對齊 Mac img4/5/6。
- 注意：Week/Month 的標題與星期格式 **本輪不動**（zh-TW 已對齊，見 §0）。
- **驗收：** 三個視圖頂部 segmented 都在左上；切換與 URL `?mode=` 同步照舊。

### 批次 4 — Cards 對齊

**檔案：** `cards/cards-feed.tsx`、`cards/card-detail.tsx`、`app/[locale]/(app)/cards/[id]/page.tsx`

- **〔功能移除〕Cards 頁頭精簡：** `cards-feed.tsx`
  - 移除「Cards」頁標題文字（第 138–151 區）、清除(Eraser) icon（第 153–161）、**list/grid 切換鈕**（第 165–207 view switch）。
  - 保留：搜尋框、tag chips、網格（固定 grid）、新增 `+` 按鈕（Mac 左上有 +）。
- **〔結構改動／本批最重〕Card 詳情改 master-detail：** Mac img9 = 左側卡片清單保留 + 右側詳情同頁。
  - 現況：`/cards/[id]` 全寬 `CardDetail` + 返回箭頭。
  - 目標：在 `/cards` 採**分割視圖**（左清單 + 右詳情），選卡片 → 右側顯示詳情，不再跳全寬頁。
  - **實作參考既有 `notes/notes-split.tsx` 模式**（同 repo 已有 split + resize handle 樣板），降低風險。
  - 深連結 `/cards/[id]` 仍要可用（直接開到該卡片的 split 狀態）。
- **驗收：** Cards 頁無標題/eraser/切換鈕；點卡片在右側開詳情、左清單保留；`/cards/[id]` 直開正常；編輯存檔後清單預覽更新。

### 批次 5 — 右側 Cards 面板 + Notes

**檔案：** `daily/daily-cards-panel.tsx`、`notes/note-entry.tsx`

- **〔功能移除〕右側 Cards 面板精簡：** `daily-cards-panel.tsx`
  - 移除展開式搜尋框 + tag chips（第 64–74、94–124）；2 欄 `xl:grid-cols-2`（第 139）→ **單欄**寬鬆。
  - 對 Mac img2「Recent Cards 12」：標題 + 單欄大卡片 + 僅一個搜尋 **icon**（不常駐輸入框）。
- **〔功能移除〕Notes 時間軸攤平：** `note-entry.tsx`
  - 移除垂直線 + 圓點（第 43–50）。
  - 日期直排（第 57–68）改為 Mac 的日期區塊卡樣式（大數字 + 月/星期），整列為一張 block、無連接線。
  - 選中態 `bg-selected-fill`（第 40）保留。
- **驗收：** 右側面板單欄、無搜尋框/tags；Notes 清單無時間軸線與圓點、呈日期區塊卡；選中態正常。

---

## 2. 明確「拿掉 web 功能」清單（使用者已同意全拿）

| 功能 | 位置 | 批次 |
| --- | --- | --- |
| 頂部 inline「Add a task」輸入框（改 FAB） | `task-create.tsx` | 2 |
| 任務列 `FileText` 筆記 icon | `task-card.tsx` | 2 |
| Cards 頁 list/grid 切換鈕 | `cards-feed.tsx` | 4 |
| Cards 頁 Eraser 清除鈕 + 頁標題 | `cards-feed.tsx` | 4 |
| Card 詳情全寬頁（改 master-detail） | `card-detail.tsx` | 4 |
| 右側 Cards 面板的搜尋框 + tag chips + 2 欄 | `daily-cards-panel.tsx` | 5 |
| Notes 時間軸垂直線 + 圓點 | `note-entry.tsx` | 5 |

> 若 review 時想保留其中任一項，標出來即可，從對應批次剔除。

## 3. 本輪**不動**（原列為差異、實為 locale）

- Month 視圖標題「2026 年 6 月」（`month-view.tsx:39` 已正確）。
- Week 視圖星期標題「星期一 6/8」（`week-view` `EEEE` zh-TW 已正確）。
- 右側 Calendar 面板時段分組 / 地點 icon（觀感已足夠接近，低優先）。

## 4. 通用守則

- 顏色一律 token（`--primary` / `--selected-fill` / `--selected-stroke` 等，`globals.css`）；禁硬編碼 hex / Tailwind 預設色。
- 新 i18n key（如 FAB aria-label）一律：改 `i18n/canonical/zh-TW.json` → `npm run i18n:sync` → en/ja 待譯列入 `.pending-translations.md`（對話中請使用者翻）→ 再 sync。**不可手改 `src/messages/*.json`**。
- **CLAUDE.md 鐵則：** 動 Next.js API 前先讀 `node_modules/next/dist/docs/` 相關章節。
- **完成定義：** `npx next build` 通過 **＋ 使用者瀏覽器實測**（每批附驗收清單）＋ commit/PR。互動功能（FAB、master-detail、週列點選、resize）必須實際操作整條路徑，不可只 build。

## 5. 風險 / 待釐清

- **批次 4 master-detail** 是唯一結構改動，風險最高 → 借用 `notes-split.tsx` 既有樣板；先確保 `/cards/[id]` 深連結不壞。
- **批次 2 FAB** 取代常駐輸入框是交互改變 → 確認「點 FAB → 出現輸入 → enter 新增 → 焦點/清空」整條路徑（含 reload 後狀態）。
- **DateHeading 改英文**（zh-TW 也顯示「June 11, 2026」）是刻意對 Mac 的「中文版用英文日期」風格；若 review 覺得突兀可回退為中文格式。

## 6. 建議實作順序

批次 1 → 2 → 3 → 5 → 4（master-detail 最重、放最後，前面累積視覺回饋後再動結構）。

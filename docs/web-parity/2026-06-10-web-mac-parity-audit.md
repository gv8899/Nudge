# Web ↔ Mac Parity Audit（2026-06-10）

> 目的：Web 對標 macOS App 的設計/交互。本文件 = 全盤 delta 盤點 + 建議施工順序。
> 鏡頭：**桌機瀏覽器優先**；手機瀏覽器不壞即可。
> 方法：5 個平行 agent 逐 surface 比對兩側程式碼（Cards / Daily / Calendar / Notes / Shell+Settings+Tokens），由主線整合並修正錯誤。

## 0. 前提決策（已拍板）

- **恢復 web 登入**（還原 PR #20）— web 回歸正式平台。
- 整體是多子專案：一次 spec 一塊，每塊獨立 PR + 瀏覽器實測。
- 後端共用不動；本輪純前端（`src/`）。

## 1. 總結論

| Surface | 現況 | Gap 等級 |
| --- | --- | --- |
| **Calendar** | Web 只有 Daily 右側 300px 單日 panel；無獨立頁、無週/月 | **大（唯一功能空白）** |
| **Daily** | 任務流完整；缺 Mac 的可切換右面板（Calendar/Cards）與多項視覺整理 | 中 |
| **Cards** | 功能上 web 還領先（list/grid、clean-untitled）；差視覺/交互細節 | 小-中 |
| **Notes** | 兩邊資料模型/編輯器已同步；差 Mac 的 split pane 桌面佈局 | 中 |
| **Shell/Settings** | sidebar 純 icon 無標籤、無 Calendar 入口；Settings 結構略異 | 小-中 |
| **Design tokens** | 色 token 同源；**缺語意字級系統 + hover/selected fill token** | 基礎工程 |

**後端 readiness**：`/api/calendar/events` 已支援 `date + endDate + tz` 任意區間、多日曆、連線狀態 —— **Calendar build-out 零後端改動**。

## 2. 跨 surface 基礎工程（先做，所有後續改版都吃它）

| 項目 | Web 現況 | Mac | 行動 | 工數 |
| --- | --- | --- | --- | --- |
| 語意字級系統 | 無；各元件散落 Tailwind class | `Font+Nudge.swift` 22 個語意角色（columnTitle / rowTitle / rowMeta / fieldText / chipLabel / dateEyebrow / dateTitle…） | 在 globals.css / Tailwind 建對應 utility（`.text-column-title` 類），鋪底後各 surface 改版逐步換用 | M |
| 互動態 fill token | 元件內 inline（`bg-primary/10` 等） | `nudgeHoverFill`(fg 6%)、`nudgeSelectedFill`(primary 14%)、`nudgeSelectedStroke`(primary 60%) | globals.css 加 `--surface-hover` 已有，補 `--selected-fill` / `--selected-stroke`，統一使用 | S |
| 語意狀態色 | 只有 task status 色 | `nudgeSuccess/Warning/Info` | 加 `--success/--warning/--info`（需要時用） | S |
| 色值對帳 | globals.css | xcassets | 抽查確認兩邊 hex 一致（應同源，驗證即可） | S |
| 字級縮放（⌘+/-） | 無 | 0.85–1.4 縮放 + 持久化 | 後補；非本輪必須 | M（緩） |

## 3. Surface 別 delta（採用/保留判斷）

### 3.1 Calendar（最大塊 — 需獨立 spec + 視覺討論）

**Mac 功能盤點**（要在 web 重現的目標）：
- Host：`日|週|月` segmented（@AppStorage 持久化）；日/週置中 720pt（對齊 Cards 欄寬）、月撐滿；range 隨 mode 計算（day 抓整週供 strip 圓點）。
- 日：週 strip（7 鈕 + 事件圓點）→ 上午/下午/晚上分段事件卡（時間欄 56pt monospaced、過去事件淡化）。
- 週：agenda 式（區間 title3 semibold；星期分組 headline、空日淡化）；prev/next/本週。
- 月：TimeTree 式 —— 6×7 等高格撐滿、**每格最多 3 條事件 bar + `+N`**、今天實心圓/選中描邊、點空白選日、再點同日切日檢視、點 bar 開 detail、pad 日淡化。
- 事件 detail：時間+標題、Join Meeting 鈕、地點/日曆名/描述/出席者/連結。Mac 用 popover。
- 空態：未連線（connect CTA）/ 需重新授權 / 無事件 / 錯誤。

**Web 可重用**：`calendar-event-item`（展開式事件卡，比 Mac 還完整）、`calendar-nav`（週 strip）、`calendar-empty-state`（4 變體）、`use-calendar-events` hook、事件 API。

**Web build 開放設計題（留給 spec 討論）**：
1. `/calendar` 獨立路由 + sidebar 入口（建議）；URL state `?mode=&date=` 可書籤化。
2. 月格「再點同日切日檢視」在滑鼠/觸控板的對應（dblclick？或格內 hover affordance？）。
3. 事件 detail：桌機 slide-in panel vs popover vs modal。
4. 手機瀏覽器降級策略（不壞即可：月格縮欄/改清單？）。
5. 週 strip 在獨立日曆頁的圓點資料源（現吃 `/api/daily/week` 任務點，應改吃 calendar events）。

### 3.2 Daily

採用 Mac（依影響排序）：
1. **右側面板升級**：固定 300px Calendar → 可開關 + Calendar/Cards 切換 + 可拖寬（localStorage 持久化）。Cards 面板含收合式搜尋 + tag chips + 近期卡片 grid。（L；Daily 最大塊）
2. 兩行日期 header（weekday eyebrow 淡色 + 大日期）。（S）
3. Row 整理：Repeat/Bell badge 從 row 移到 popover/detail；move-to-date 升級成獨立 calendar icon、`…` 留次要動作。（S）
4. 「已完成 (N)」可收合分組 header（web 現在只是排到底部）。（S）
5. 空態加 sparkles icon。（S）
6. 完成任務標題加刪除線。（S）
7. Task detail 由全螢幕 modal 改 Heptabase 式置中卡 popover（blur backdrop）。（M）

保留 web：inline 改標題（比 Mac popover 快）、dnd-kit 拖序、SWR（vs Mac 輪詢）、quick-add inline form（桌機比 FAB 好）、Radix context menu。

### 3.3 Cards

採用 Mac：搜尋列釘頂 + tag chips 在下（持久顯示）；空態時搜尋列固定頂部、訊息置中剩餘空間；list/grid row 拿掉 tags（降噪，tags 留 detail）；grid 預覽 120→240 字；grid 選中態（selected fill/stroke —— 需 feed 記 selectedCardId）；detail header 返回鍵改 chevron+primary、移除分隔線；Untitled 斜體淡色。

保留 web（明確不照搬）：route 式 detail（可書籤/分享/前後退 —— 對瀏覽器本質正確，不做 Mac split pane）、list/grid 切換、clean-untitled、inline tag picker popover、inline 改標題。

### 3.4 Notes

採用 Mac：**桌機 split pane**（左 feed 720 置中 + 右 canvas 360–900 可拖寬、localStorage 持久化；md 以下退回現有 toggle）；feed 預覽改純文字 ~220 字（現在整段 HTML 直渲）；「今天」placeholder row（今日未寫時頂部出現假 row，點了開今天 canvas）；row 高度標準化（min 88px）；存檔後 feed 自動 refetch（SWR mutate）。

已對齊：編輯器（同 TipTap 配置）、800ms debounce、分頁 10 筆、消毒。

### 3.5 Shell / Settings / Tags

採用 Mac：
- **sidebar 加 Calendar 入口**（跟 Calendar build 同 PR）。
- sidebar 標籤化（icon+文字，Mac 是 180–280pt 標籤側欄；web 56px 純 icon）— 可做成桌機寬、窄窗收合。
- Settings 增加 `/settings` 路由版（modal 保留快速入口）；登出+清理合併成 Danger Zone；補 Clean Untitled Cards。
- Tag manager：拖把手獨立手勢區（避免與 rename 衝突）、刪除加確認、新增列加 plus icon；picker 搜尋框加 icon + clear 鈕。

保留 web：theme/語言用按鈕組（Mac 用 Menu 是為了避 AppKit bug，web 沒這問題）、紙紋理開關（web 專屬）、tag badge 小尺寸（與 filter chip 角色不同）、頭像帳號卡。

Mac 反向欠的（記下不在本輪）：Notifications 設定 UI（web 有 Mac 沒有）、clean-untitled、list/grid 切換。

## 4. 建議施工順序

| Phase | 內容 | 為什麼這順序 |
| --- | --- | --- |
| **P0 地基** | 恢復登入（revert PR #20）＋ §2 token/字級系統 | 每個後續 PR 都會用到；先鋪避免回頭改兩次 |
| **P1 Calendar** | `/calendar` 路由 + sidebar 入口 + 日/週/月 + TimeTree 月格 + 事件 detail（獨立 spec，含視覺討論） | 唯一功能空白、可見度最高；後端零改動 |
| **P2 Daily** | 右面板升級（toggle/Cards/resize）+ header/row/completed 整理 | 第二大塊；依賴 P0 token |
| **P3 Cards** | §3.3 細節批次 | 小而多，一個 PR 收 |
| **P4 Notes** | split pane + feed 整理 | 獨立性高，何時做都行 |
| **P5 Shell/Settings** | sidebar 標籤化、settings 路由/重組、tags 細節 | 收尾拋光 |

每 phase：spec（需要時）→ plan → subagent 實作 → `npx next build` + **瀏覽器實測**（互動由使用者代跑）→ PR。

## 5. 已知更正

- Daily audit 原文一處錯誤：「Mac removed calendar from Daily」— 不實。Mac Daily **有**可切換右側面板（Calendar/Cards、可拖寬），此正是 web 要補的目標（§3.2-1）。

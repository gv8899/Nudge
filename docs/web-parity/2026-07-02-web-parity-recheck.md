# Web ↔ Mac/iOS 功能對齊複查（2026-07-02）

> 背景：P0–P5（PR #21）+ 第二輪（PR #22）已進 main，之後又疊了 billing/legal/landing。本文件複查「現況」web vs Apple 的**功能**落差（非像素視覺）。
> 方法：5 個平行 agent 逐 surface 比對兩側現行程式碼（Calendar / Daily / Cards / Notes / Shell+Settings+Tags）。

## 總結

核心架構已對齊；Notes 幾乎完全一致（web 甚至略領先）。剩下為具體功能點落差，分四類：A) web 疑似 bug/回歸、B) web 真缺功能、C) web 領先（保留）、D) 平台刻意分歧（非落差）。

---

## A. Web 疑似 bug / 回歸（不論對齊都該修）

| # | 問題 | 證據 | 影響 |
| --- | --- | --- | --- |
| A1 | Cards 快速 Modal **關閉時無 flush 存檔**，只有 800ms debounce；在 debounce 窗內關 Modal / 導航會掉最後一次編輯 | `task-detail-modal.tsx:104-116`、`card-detail.tsx:124-137`；Apple 有 blur/disappear/tab-switch flush（`CardDetailView.swift:142-171`） | 資料遺失 |
| A2 | Cards 快速 Modal **缺 tags/排程**（CardsFeed 沒傳 `onTagsChange`/tags），只能在全頁改 | `cards-feed.tsx:66-80` vs 全頁 `card-detail.tsx:248-267`；Apple detail 每個入口都帶（`CardDetailView.swift:107-113,172-213`） | 功能不完整 |
| A3 | Calendar 獨立頁「日檢視」週列圓點**吃錯資料源** — 用 `/api/daily/week`（任務）而非 calendar events | `calendar-nav.tsx:38-43`、`day-view.tsx:72`；Apple 由已載入事件算（`CalendarHostView.swift:333-336`） | 圓點與事件不符 |
| A4 | Cards grid 選中態沒接線（`CardGridItem` 有 `selected` prop 但 `CardsFeed` 沒傳），開著 Modal 時對應卡片不高亮 | `card-grid-item.tsx:15-20` 未被 `cards-feed.tsx:222-231` 使用；Apple 有（`CardsHostView.swift:419`） | 視覺回饋缺失 |

## B. Web 真缺功能（Mac/iOS 有）

| # | 缺口 | 證據 | 優先 |
| --- | --- | --- | --- |
| B1 | **一般/今日任務無法封存** — web 封存只在 overdue section，一般 row overflow menu 沒有 | `task-card.tsx:73-90` vs Apple 每 row 都有（`TaskRowView.swift:157-190`、`TaskRowMenu.swift:107-113`） | 高 |
| B2 | **提醒必須綁重複規則** — `preset===null` 時顯示 requiresPreset、無輸入；無法對一次性任務設「絕對日期+時間」提醒 | `schedule-section.tsx:290-318`；Apple 提醒獨立於重複（`ScheduleSection.swift:257-307`） | 高 |
| B3 | **重複選項較少** — 缺 weekdays / yearly preset；monthly_day 唯讀（不能選 1–31） | `schedule-section.tsx:17-24,217-223`；Apple 有（`ScheduleSection.swift:128-141,361-363`） | 中 |
| B4 | **無 offline / error banner + retry**（Daily 只在 401 硬跳轉，其餘 SWR 靜默） | `daily-view.tsx:340-345`；Apple `OfflineBannerView`/`ErrorBannerView`（`DailyHostView.swift:114-120`） | 中 |
| B5 | Calendar 載入失敗**無 error UI / retry**（會靜默變空清單） | web 有 error 變體 `calendar-host.tsx:75-81`（此點反而是 web 領先，見 C）；此列指 Apple 側 — 已對調，見 C7 | — |
| B6 | **設定頁無帳號刪除**（App Store 5.1.1(v) 要求，Apple 有） | `settings-content.tsx:258-343` 只有 clean-untitled + logout；Apple `SettingsView.swift:436-442` | 中（法遵） |
| B7 | Calendar 事件詳情**缺日期前綴**（只顯示時間），Apple 有「5月7日(四) · 09:00–10:00」 | `event-popover.tsx:27-29` vs `CalendarEventDetailSheet.swift:102-109` | 低 |
| B8 | iOS 有 cards-scoped **Search 專屬入口**，web sidebar 無（web 靠 Cards 頁釘頂搜尋，功能其實可達） | `PlatformRootView.swift:87-95` vs `app-sidebar.tsx:16-46` | 低 |
| B9 | Notes iOS feed 無「今天」placeholder row（web 桌機+手機都有） | `NotesFeedView.swift:170-180` 只 `#if os(macOS)` — 這是 **iOS 缺、非 web 缺**，見 C | — |

## C. Web 領先 / 有、Apple 缺（保留，別回收）

- Notifications 偏好編輯器（Apple settings 完全沒有）— 最大反向缺口
- 紙紋理外觀開關、帳號 joinedAt + 頭像
- `/admin` promo 後台（web-only，預期）
- Route-based deep-link：`/cards/[id]`、`/notes/[date]`、Calendar `?mode=&date=` 可書籤
- Skip / 封存 **確認對話框**（Apple 立即執行不確認）
- Calendar：`htmlLink`「在 Google 開啟」、error+retry、獨立 reauth 狀態、attendee +N 上限、月格 responsive 降級
- Notes：block 拖曳把手、per-date deep-link
- Overdue row inline「排到今天」文字鈕

## D. 平台刻意分歧（非落差，勿改）

- iOS Cards：不走快速 Modal，點卡直接 push 全頁 detail；搜尋是獨立 tab（macOS+web 才走 Modal→展開）
- Detail 呈現：web Base UI popover / Apple sheet(iOS)·popover(macOS)
- Auth：web NextAuth vs Apple SIWA/Bearer（獨立堆疊）
- 兌換碼：兩邊 settings 都沒有，移到 paywall/checkout（Slice B）
- list/grid：**兩邊都無使用者 toggle**（web `card-list-item.tsx` 對此 surface 是死碼）；memory 舊記的「web list/grid 優勢」在現行碼不成立

## 建議施工優先序

1. **A1 Cards 掉存檔** — 資料遺失，最該先修
2. **B1 一般任務封存 + B2 一次性提醒** — 使用者實際會撞到的功能缺
3. **A2/A3/A4** — Cards Modal tags/排程、Calendar 圓點資料源、grid 選中態
4. **B3 重複選項、B4 Daily banner** — 完整度
5. **B6 帳號刪除** — 上架法遵
6. B7/B8 低優，視情況

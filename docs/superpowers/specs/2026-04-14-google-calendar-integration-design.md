# Google Calendar 整合設計

> **目標**：讓使用者在 Nudge 的 Tasks 頁看到當天 Google Calendar 事件，並可點擊 inline 展開細節。唯讀模式，不做雙向同步。

**Scope**：單一實作計畫，web + mobile 一次做完。
**Tech stack**：Next.js 16（後端 + web 前端）、Flutter（mobile）、Google Calendar API v3、NextAuth v5 既有 Google provider、Drizzle ORM、SWR。

---

## 1. 系統架構

### 1.1 高層資料流

```
使用者
  │
  ├─ 設定 → 「連結 Google Calendar」
  │         → /api/calendar/connect 產生 OAuth URL（scope: calendar.readonly）
  │         → Google 授權頁 → /api/calendar/callback
  │         → 換 access_token + refresh_token、加密存 DB
  │         → 轉回 /settings，UI 顯示「已連結」
  │
  ├─ 進入 Tasks 頁 → 前端 SWR 呼叫 /api/calendar/events?date=YYYY-MM-DD&tz=Asia/Taipei
  │                → 後端驗 session、取使用者 tokens
  │                → 必要時自動 refresh access_token
  │                → 並行呼叫所有勾選子日曆的 events.list
  │                → 合併排序回傳
  │
  └─ 點事件 → inline 展開細節（資料來自同一次回傳的 payload，不再打 API）
```

### 1.2 平台一致性

- **Web** 和 **Mobile** 共用同一個後端 API `/api/calendar/*`
- OAuth 連結**只在 web 端**做一次；mobile 讀同一個使用者的 DB tokens
- Mobile 未連結時的橫幅按下 → 開 `https://<web-host>/settings` 引導到 web 完成連結

### 1.3 關鍵決策

- **不做伺服器端 cron 主動同步** — 事件只在使用者進頁面時 fetch，省 API quota
- **Google Calendar API 呼叫從 Next.js 後端發出** — client 不接觸 token
- **Token refresh 由後端自動處理** — access_token 過期就用 refresh_token 換新，使用者無感
- **Token 在 DB 加密儲存** — AES-256-GCM 對稱加密，避免 DB dump 直接洩漏

---

## 2. 資料流與 Token 管理

### 2.1 DB schema 變更

`users` 表（Postgres, Drizzle ORM）新增 4 個欄位。所有時間在這個 repo 都存 ISO 字串（`text`），不用 Postgres `timestamp` 欄位，保持風格一致：

```ts
// src/lib/db/schema.ts 加進既有的 users pgTable 定義
googleCalendarAccessToken:  text("google_calendar_access_token"),  // AES-256-GCM 加密，"iv.tag.ct" 格式
googleCalendarRefreshToken: text("google_calendar_refresh_token"), // 同上
googleCalendarTokenExpires: text("google_calendar_token_expires"), // ISO 字串，UTC
googleCalendarSelectedIds:  text("google_calendar_selected_ids"),  // JSON array string, e.g. '["primary"]'
```

Migration 由 `drizzle-kit generate` 產出（實作時檔名由工具決定）。四個欄位都 nullable、預設 null；已上線使用者值為 null，視為未連結。

### 2.2 連結流程

1. 設定頁點「連結 Google Calendar」→ `window.location = '/api/calendar/connect'`
2. `/api/calendar/connect` 產生 Google OAuth URL：
   - `client_id`: `GOOGLE_CLIENT_ID`
   - `redirect_uri`: `GOOGLE_CALENDAR_REDIRECT_URI`
   - `scope`: `https://www.googleapis.com/auth/calendar.readonly`
   - `access_type`: `offline`（強制發 refresh_token）
   - `prompt`: `consent`（強制每次都 refresh_token，避免使用者重連時拿不到）
   - `state`: random nonce 存 session，callback 驗證
3. 使用者在 Google 授權 → 跳回 `/api/calendar/callback?code=...&state=...`
4. Callback:
   - 驗 `state` 對得上
   - POST `https://oauth2.googleapis.com/token` 換 token
   - 加密 access_token + refresh_token（`lib/google-calendar/crypto.ts`）
   - 寫入 DB，同時預設 `selected_ids = ["primary"]`
   - 轉址 `/settings`（帶 query flag `?calendar=connected` 供設定頁顯示 toast）

### 2.3 讀取流程

`GET /api/calendar/events?date=2026-04-14&tz=Asia/Taipei`

1. 從 session 拿 `user_id`
2. 讀 DB tokens：
   - 如果完全沒 token → 回 `{ connected: false }`（200 OK）
3. 如果 `token_expires < now + 60s`：
   - 用 refresh_token 換新 access_token
   - 寫回 DB
   - 如果換不到（refresh_token 失效）→ 清 DB 三個 token 欄位 → 回 `{ connected: false, reason: "reauth_required" }`
4. 根據 `tz` 算出當日 00:00 – 24:00 的 ISO 字串（`timeMin`/`timeMax`）
5. 並行呼叫每個 `selected_ids` 的：
   ```
   GET /calendar/v3/calendars/{id}/events?timeMin=...&timeMax=...
       &singleEvents=true&orderBy=startTime&maxResults=100
   ```
6. 合併、按開始時間排序、映射成統一 shape：
   ```json
   {
     "connected": true,
     "events": [
       {
         "id": "abc123",
         "calendarId": "primary",
         "calendarName": "mike@example.com",
         "title": "Design review",
         "start": "2026-04-14T11:30:00+08:00",
         "end": "2026-04-14T12:30:00+08:00",
         "allDay": false,
         "location": "Zoom",
         "description": "Review of Q2 wireframes...",
         "attendees": ["alice@x.com", "bob@x.com"],
         "htmlLink": "https://calendar.google.com/event?eid=..."
       }
     ]
   }
   ```

### 2.4 子日曆管理

`GET /api/calendar/calendars` — 回傳使用者所有可用子日曆（`calendarList.list`），供設定頁顯示勾選清單：
```json
{
  "calendars": [
    { "id": "primary", "summary": "mike@example.com", "backgroundColor": "#a87a45", "primary": true },
    { "id": "work@group.calendar.google.com", "summary": "Work", "backgroundColor": "#5a7050" }
  ],
  "selectedIds": ["primary"]
}
```

`POST /api/calendar/calendars` — body `{ "selectedIds": ["primary", "work@..."] }` — 更新 DB 的 `selected_ids`。

### 2.5 Disconnect

`POST /api/calendar/disconnect` — 清掉 DB 四個欄位（三個 token + selected_ids）→ 回 `{ connected: false }`。

**不**呼叫 Google revoke endpoint；使用者可自行從 Google 帳戶撤銷授權。

### 2.6 Token 加密

`src/lib/google-calendar/crypto.ts`：
- 使用環境變數 `CALENDAR_TOKEN_KEY`（32-byte, base64-encoded）
- AES-256-GCM，每次加密產生隨機 12-byte IV
- 儲存格式：`base64(iv) + "." + base64(authTag) + "." + base64(ciphertext)`
- 匯出 `encrypt(plaintext: string): string` 和 `decrypt(stored: string): string`

### 2.7 前端快取（SWR）

- Key: `["calendar-events", date]`
- `keepPreviousData: true`（切日期時保留舊資料避免閃爍）
- `revalidateOnFocus: true`（切回 tab 自動刷新）
- 手動「重新整理」按鈕呼叫 `mutate(key)`

---

## 3. 元件分解

### 3.1 後端 (Next.js)

```
src/app/api/calendar/
├── connect/route.ts      GET  — 產生 OAuth URL + state、轉址
├── callback/route.ts     GET  — 收 code、換 token、加密存 DB、轉回 /settings
├── disconnect/route.ts   POST — 清 DB tokens
├── events/route.ts       GET  — 回當日事件（已處理 refresh）
└── calendars/route.ts    GET  — 列出使用者所有子日曆
                          POST — 更新 selected_ids

src/lib/google-calendar/
├── oauth.ts              — buildAuthUrl(), exchangeCode(), refreshAccessToken()
├── api.ts                — listCalendars(), listEvents()
└── crypto.ts             — encrypt(), decrypt()

src/lib/db/schema.ts      — users 表新欄位
drizzle/migrations/...    — `drizzle-kit generate` 產出的 migration
```

### 3.2 Web 前端

```
src/components/calendar/
├── calendar-panel.tsx         — 左側 260px 面板主容器（Tasks 頁專屬）
├── calendar-event-item.tsx    — 單一事件列 + inline expand 細節
├── calendar-empty-state.tsx   — 未連結 / 無事件 / 錯誤三種狀態
└── use-calendar-events.ts     — SWR hook

src/components/settings/
└── calendar-section.tsx       — 設定頁新區塊：連結狀態 + 子日曆勾選 + disconnect

src/app/[locale]/(app)/day/[date]/page.tsx  — 引入 <CalendarPanel />
src/components/settings/settings-modal.tsx    — 加入 CalendarSection
```

**CalendarPanel 只在 Tasks 頁顯示**：由 Tasks 頁自己引入 `<CalendarPanel />`，不放在全域 layout。Sidebar icon rail 維持全域。DOM 結構上 panel 隸屬 Tasks 頁，切到卡片/日誌時自動不顯示。

### 3.3 Mobile (Flutter)

```
mobile/lib/features/calendar/
├── calendar_models.dart        — Event model 對映後端 JSON
├── calendar_repository.dart    — 呼叫後端 /api/calendar/events
├── calendar_controller.dart    — Riverpod state: events, loading, error, collapsed
├── calendar_strip.dart         — 收合時的薄橫幅
└── calendar_expanded.dart      — 展開時的事件列表 + inline detail

mobile/lib/features/tasks/tasks_screen.dart    — 週曆下方放 CalendarStrip
mobile/lib/features/settings/settings_screen.dart — 加入日曆區塊（顯示連結狀態 + 導到 web 的按鈕）
mobile/lib/l10n/app_{zh,en,ja}.arb              — 新增 calendar 命名空間
```

### 3.4 i18n 新增 key（命名空間 `calendar`）

```
calendar.connect.title          連結 Google Calendar
calendar.connect.description    看看今天有哪些會議
calendar.connect.button         連結
calendar.disconnect.button      中斷連結
calendar.disconnect.confirmTitle  中斷連結
calendar.disconnect.confirmBody   確定要中斷 Google Calendar 連結嗎？
calendar.panel.title            今日行程
calendar.panel.empty            今天沒有行程
calendar.panel.loading          載入中…
calendar.panel.error            無法載入行事曆
calendar.panel.retry            重試
calendar.panel.reauth           授權過期，請重新連結
calendar.panel.refresh          重新整理
calendar.event.allDay           整日
calendar.event.busy             忙碌
calendar.event.location         地點
calendar.event.attendees        與會者
calendar.event.description      描述
calendar.event.openInGoogle     在 Google Calendar 開啟
calendar.mobile.collapsedCount  今日行程 · {count} 件
calendar.mobile.collapsedEmpty  今日無行程
calendar.settings.section       行事曆
calendar.settings.connectedAs   已連結：{email}
calendar.settings.subCalendars  顯示哪些日曆
```

---

## 4. UX 狀態

### 4.1 面板狀態表

| 狀態 | 畫面 |
|---|---|
| **未連結** | 「連結 Google Calendar」按鈕 + 一行說明 |
| **載入中** | Skeleton 事件卡片 × 3 |
| **已連結・今日有事件** | 事件列表，依開始時間排序，過去事件半透明 |
| **已連結・今日無事件** | 小圖示 + 「今天沒有行程」 |
| **網路/API 錯誤** | 「無法載入行事曆」+ 重試按鈕 |
| **需重新授權** | 「授權過期，請重新連結」按鈕（POST disconnect → connect） |

### 4.2 特殊事件類型

- **整日事件 (all-day)**：放列表最上方獨立小分區，時間顯示為「整日」
- **跨日事件**：只顯示在開始日，時間標註「12:00 → 隔日 02:00」
- **重複事件**：Google API 已展開為單一 instance，無需特別處理
- **已取消 (cancelled)**：不顯示（API 預設 `showDeleted=false`）
- **私人/僅忙碌 (private)**：標題顯示「忙碌」，點擊不展開細節（沒細節可看）

### 4.3 時區處理

- **Web**：`Intl.DateTimeFormat().resolvedOptions().timeZone` 當 `tz` 參數
- **Mobile**：`DateTime.now().timeZoneName` 當 `tz` 參數
- 後端用 `tz` 算當日 00:00–24:00 的 range

### 4.4 Inline Expand 行為（web + mobile 一致）

- 點事件 → 就地往下展開，顯示：地點 / 與會者 / 描述 / 「在 Google Calendar 開啟」連結
- 同時只能展開一個；點另一個會先收起前一個
- 收起動畫約 200ms；展開用 height animation
- 展開狀態**不**持久化（換頁回來都是收合）

### 4.5 Mobile 收合橫幅

- **位置**：Tasks 頁上方，週曆 bar 下方、任務列表上方
- **收合時**：顯示「今日行程 · N 件 ⌄」或「今日無行程」；未連結顯示「連結 Google Calendar →」
- **展開時**：橫幅往下延伸出事件列表（inline expand 和 web 一致）
- **持久化**：收合/展開狀態用 SharedPreferences 記住；下次進 App 保持上次狀態

### 4.6 Disconnect 行為

設定頁「中斷連結」→ 確認對話框 → POST `/api/calendar/disconnect` → SWR mutate → UI 立即回到「未連結」。

---

## 5. 錯誤處理

### 5.1 後端

- 所有 Google API 呼叫包在 try/catch
- 錯誤分類：
  - `401 invalid_grant` / refresh_token 失效 → 清 DB tokens → 回 `{ connected: false, reason: "reauth_required" }`
  - 其他 4xx/5xx → 回 `{ error: "fetch_failed" }`（500 狀態碼）
- Server log 記錄完整錯誤（status、error message、user_id），便於除錯
- **不**把 Google 原始錯誤訊息回給前端（避免洩漏內部細節）

### 5.2 前端

- SWR error 分兩類處理：
  - `reason === "reauth_required"` → 顯示「授權過期，請重新連結」按鈕
  - 其他 → 顯示 generic「無法載入行事曆」+ 重試
- 重試按鈕呼叫 `mutate(key)`
- Token refresh 時的 loading 狀態對使用者透明（就是 SWR 的 isLoading）

---

## 6. 測試策略

### 6.1 後端

- **單元測試**
  - `crypto.ts`：encrypt → decrypt round-trip、錯誤的 ciphertext 拋例外
  - `oauth.ts`：mock `fetch`，測試 buildAuthUrl、exchangeCode、refreshAccessToken
  - `api.ts`：mock Google API response，測試 listCalendars、listEvents 的 shape 轉換
- **整合測試**（mock DB + Google API）
  - `/api/calendar/events`：未連結、已連結有事件、已連結 token 過期需 refresh、refresh 失敗、API 錯誤
  - `/api/calendar/callback`：正常流程、state 不符、code 無效
  - `/api/calendar/disconnect`：清 DB 正確

### 6.2 前端

- `calendar-panel.tsx`：各狀態 snapshot 測試
- `use-calendar-events`：SWR key、keepPreviousData 行為
- `calendar-event-item`：inline expand open/close

### 6.3 Mobile

- Widget test `calendar_strip`、`calendar_expanded`
- Repository 的 mock fetch（正常、404、401）
- Collapsed 狀態 SharedPreferences 持久化

### 6.4 手動 QA

必須實際連結一個 Google 帳號走完整流程：
1. 未連結狀態 → 點連結 → Google 授權 → 跳回設定頁看到「已連結」
2. 進 Tasks 頁看到今日事件
3. 點事件 → inline 展開看細節
4. 設定頁勾選/取消子日曆 → Tasks 頁事件列表對應更新
5. Mobile 收合 / 展開、事件展開
6. Disconnect → 確認 UI 回到未連結
7. 測試 token refresh：手動把 DB 的 `token_expires` 改成過去時間，重新整理 → 應該自動拿到新 token 繼續正常
8. 測試 reauth：手動把 DB 的 refresh_token 改亂 → 重新整理應該顯示「授權過期」

---

## 7. 範圍 / 非目標

### 7.1 In scope

- ✅ Google OAuth 連結流程 + token 加密存 DB
- ✅ 後端 `/api/calendar/*` 全套（connect / callback / disconnect / events / calendars）
- ✅ Web 左側日曆面板（Tasks 頁專屬）+ inline expand
- ✅ Mobile Tasks 頁薄橫幅 + 展開 + inline expand
- ✅ 設定頁「連結 / 中斷 / 子日曆勾選」（web + mobile）
- ✅ i18n 三語（zh-TW / en / ja）
- ✅ 所有 UX 狀態

### 7.2 Out of scope

- ❌ 雙向同步（Nudge 任務 ↔ Google 事件）
- ❌ 建立 / 編輯 / 刪除事件
- ❌ Outlook / iCal / Apple Calendar 等其他來源
- ❌ 事件提醒通知
- ❌ 週曆 / 月曆 view
- ❌ 拖曳任務到時段（time-blocking）
- ❌ 伺服器 cron 主動同步
- ❌ Mobile 原生 OAuth 流程（連結統一從 web 做）

---

## 8. 環境變數與部署

### 8.1 新增環境變數

```
GOOGLE_CLIENT_ID=<既有>
GOOGLE_CLIENT_SECRET=<既有>
GOOGLE_CALENDAR_REDIRECT_URI=https://<host>/api/calendar/callback
CALENDAR_TOKEN_KEY=<32-byte base64, e.g. openssl rand -base64 32>
```

### 8.2 Google Cloud Console 設定

使用者需手動做一次：
1. OAuth consent screen 加 scope `https://www.googleapis.com/auth/calendar.readonly`
2. OAuth 2.0 client 的 Authorized redirect URIs 加 `GOOGLE_CALENDAR_REDIRECT_URI`
3. 若使用「外部」app type 且未通過 verification，需把測試帳號加入 test users

### 8.3 資料庫 Migration

執行 Drizzle migration 加上 `users` 表的 4 個欄位。已上線的使用者值為 null，視為未連結。

---

## 9. 成功標準

- 使用者在設定點一次「連結」就完成，之後不需重做（refresh_token 長期有效）
- Tasks 頁進入後 < 500ms 就看到上次的快取事件（SWR）
- Token 過期時使用者完全無感（後端自動 refresh）
- 刪掉一個子日曆勾選後，事件列表在下次 refetch 時立即反映
- Mobile 收合/展開狀態跨 App 啟動保持
- 失敗案例（無網路、API 錯誤、reauth）都有對應 UI 和復原路徑

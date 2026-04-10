# Nudge Flutter App 開發藍圖

## 背景

Nudge 是一個輕量型每日任務推進工具，目前以 Next.js Web App 運行（本機 SQLite）。目標是開發 Flutter 跨平台 App（iOS + Android），涵蓋 Web 的所有功能，並將後端部署到雲端讓兩端共用。

## 技術決策

| 項目 | 決定 | 理由 |
|------|------|------|
| App 框架 | Flutter (Dart) | 一套 codebase 出 iOS + Android，原生效能 |
| 後端 | 沿用現有 Next.js API routes | API 已完整，一人開發維護成本最低 |
| 資料庫 | SQLite → PostgreSQL | 雲端部署必要，Drizzle 支援切換 |
| 部署平台 | Zeabur | 已在使用，一站搞定 Next.js + PostgreSQL |
| Auth | Google OAuth（Web: NextAuth / App: idToken 驗證） | 現有方案延伸 |
| 功能範圍 | 全功能（非子集） | 長期目標是 Web 和 App 功能一致 |

## Phase 總覽

```
Phase 1: 後端部署（雲端化）
    ↓
Phase 2: Flutter 基礎框架
    ↓
Phase 3: 行動（每日任務）
    ↓
Phase 4: 日誌
    ↓
Phase 5: 卡片
    ↓
Phase 6: 收尾（推播、離線、上架）
```

---

## Phase 1：後端部署

**目標：** 把 Nudge 從本機 SQLite 搬到雲端 PostgreSQL（Zeabur），讓 Flutter App 能透過網路打現有 API。調整 Auth 支援 App 登入。

### 範圍

**資料庫遷移：SQLite → PostgreSQL**
- Drizzle ORM 換 driver（`better-sqlite3` → `node-postgres`）
- Schema 不變，Drizzle 抽象層處理方言差異
- `initTables` 的 raw SQL 改成 PostgreSQL 語法
- 撰寫遷移 script：SQLite export → PostgreSQL import
- 遷移 tables：users, tasks, tags, task_tags, daily_notes, daily_task_assignments, status_history

**部署到 Zeabur**
- Next.js service + PostgreSQL service 在同一個 Zeabur project
- 環境變數：`DATABASE_URL`、`NEXTAUTH_URL`、`NEXTAUTH_SECRET`、Google OAuth credentials
- 設定 custom domain（如需要）

**Auth 擴展：支援 App 登入**
- 現有 NextAuth Google OAuth 保持不變（Web 繼續用）
- 新增 API endpoint `/api/auth/mobile`：App 用 Google Sign-In SDK 拿到 `idToken`，POST 到此 endpoint 驗證後回傳 session token
- App 後續請求帶 `Authorization: Bearer <token>` header
- `getUser()` 修改：除了 NextAuth session，也支援 Bearer token 認證

### 不做
- Flutter App 本身（Phase 2）
- 離線快取
- 改現有 API 的 request/response 格式

### 完成標準
- Web App 在 Zeabur 正常運行，功能和本機一致
- 現有資料完整遷移到 PostgreSQL
- 用 curl 打 API + Bearer token 能正確取得資料

---

## Phase 2：Flutter 基礎框架

**目標：** 建立 Flutter 專案骨架，包含 HTTP client、Auth flow、導航結構。能成功登入並看到空的 tab 頁面。

### 範圍

**專案初始化**
- Flutter 專案建立（monorepo 或獨立 repo，待定）
- 資料夾結構：feature-based（screens / models / services / widgets）
- 狀態管理方案選型（Riverpod / Bloc / Provider）
- HTTP client 封裝（base URL、Auth header、error handling）

**Google 登入**
- 使用 `google_sign_in` package
- 登入後拿 idToken → 打 `/api/auth/mobile` → 取得 session token
- Token 儲存（`flutter_secure_storage`）
- 自動登入（app 啟動時檢查 token 有效性）

**導航結構**
- 底部 Tab Bar：行動 / 日誌 / 卡片 / 設定
- 每個 tab 先放 placeholder 頁面
- 設定頁：登出功能

### 不做
- 任何業務功能 UI
- 離線快取
- 推播通知

### 完成標準
- App 能 Google 登入 → 看到四個 tab
- 登出後回到登入頁
- 重開 App 自動登入（token 未過期時）

---

## Phase 3：行動（每日任務）

**目標：** 實作每日任務的完整功能，對應 Web 的 `/day/[date]` 頁面。

### 範圍

**日曆導航**
- 週曆 bar（Mon-Sun），可左右滑動切換週
- 今天按鈕
- 有任務的日期顯示圓點標記

**任務列表**
- 顯示當天任務（title、checkbox、status badge）
- 新增任務（底部輸入框）
- 完成/取消完成（checkbox toggle）
- 拖曳排序
- 狀態切換（inbox / backlog / in_progress / waiting / done / archived）

**Overdue Section**
- 前幾天未完成的任務
- 排入今天 / 移到其他日期 / 封存
- 封存確認 dialog
- 六日預設收合

**任務詳細 Modal**
- 點擊任務標題開啟 bottom sheet / modal
- 顯示 title、status、description（富文本）
- 可編輯 description

### API 對接
- `GET /api/daily/[date]` — 當天任務 + overdue
- `POST /api/daily/[date]/tasks` — 新增
- `PATCH /api/daily/[date]/tasks` — 完成/移動
- `PUT /api/daily/[date]/tasks/reorder` — 排序
- `PATCH /api/tasks/[id]/status` — 狀態變更
- `GET /api/daily/week` — 週曆圓點

### 不做
- Tag 顯示（Phase 5）
- 離線快取

### 完成標準
- 所有任務操作和 Web 一致
- 拖曳排序流暢
- Overdue 行為正確

---

## Phase 4：日誌

**目標：** 實作日誌功能，對應 Web 的 `/notes` 頁面。

### 範圍

**Canvas 編輯器**
- 富文本編輯（標題 H1-H3、粗體、斜體、列表、checkbox、code block）
- Flutter 富文本方案選型（`flutter_quill`、`super_editor`、或自建）
- 自動儲存（debounce 後 PUT）
- 日期切換

**日誌 Feed**
- 過往日誌列表（`/notes/feed`）
- 無限捲動
- 點擊進入該日日誌

**Block 拖移**
- 評估 Flutter 中實作 block-level 拖移的可行性
- 可能簡化為「不支援拖移，用上下箭頭移動 block」

### API 對接
- `GET /api/daily/[date]/notes` — 取得日誌內容
- `PUT /api/daily/[date]/notes` — 儲存日誌
- `GET /api/notes/feed` — 過往日誌列表

### 風險
- Flutter 富文本編輯器生態不如 Web（TipTap）成熟
- HTML 格式需要在 Flutter 端 parse + render + 編輯
- 可能需要定義中間格式（JSON）或用 Markdown 作為交換格式

### 不做
- Slash command（先不做，評估後再定）
- Code block 語法高亮（先純文字）

### 完成標準
- 能編輯日誌（基本富文本）
- 自動儲存，Web 端能看到 App 的編輯結果
- Feed 正常顯示歷史日誌

---

## Phase 5：卡片

**目標：** 實作卡片系統，對應 Web 的 `/cards` 頁面。

### 範圍

**卡片列表**
- List / Grid / Kanban 三種 view 切換
- 搜尋
- 無限捲動
- Tag badge 顯示

**看板 View**
- 水平捲動 column（每個 tag 一個 column）
- 卡片拖移換 tag
- Column header（顏色圓點 + 名稱 + 數量）

**卡片詳細頁**
- 標題編輯
- 富文本 description 編輯（同日誌的編輯器）
- Tag picker
- 底部日期 + tag 資訊

**Tag 系統**
- Tag picker（搜尋、多選、新增）
- Tag 管理（設定頁：新增、改名、換色、刪除）
- 預設色盤

### API 對接
- `GET /api/cards` — 卡片列表（帶 tags）
- `GET /api/tasks/[id]` — 卡片詳細
- `PATCH /api/tasks/[id]` — 更新標題/description
- `GET/POST /api/tags` — Tag CRUD
- `PATCH/DELETE /api/tags/[id]`
- `PUT /api/tasks/[id]/tags` — 設定 tag

### 不做
- Tag 群組 / 樹狀結構
- Group by 二層分類

### 完成標準
- 三種 view 切換正常
- 看板拖移換 tag
- Tag 完整 CRUD
- 富文本編輯和 Web 一致

---

## Phase 6：收尾

**目標：** 上架前的最後一哩路。

### 範圍

**推播通知**
- 任務提醒（`remindAt` 欄位）
- 使用 Firebase Cloud Messaging (FCM)
- 後端新增推播 trigger

**離線快取**
- 本地 SQLite 快取最近 7 天的資料
- 離線時顯示快取、上線後同步
- 衝突解決策略（last-write-wins 或 queue）

**設定頁完善**
- 主題切換（light / dark / system）
- 帳號資訊
- 標籤管理

**上架**
- App icon、splash screen
- App Store 截圖、描述
- Google Play 截圖、描述
- 隱私權政策頁面

### 不做
- 多人協作
- Widget（iOS / Android 桌面小工具）— 未來考慮

### 完成標準
- iOS + Android 雙平台上架
- 推播通知正常
- 離線可讀、上線同步

---

## 開發順序與依賴

```
Phase 1 ← 所有後續 phase 的前置
Phase 2 ← Phase 3, 4, 5 的前置
Phase 3, 4, 5 ← 可平行但建議按順序（共用元件遞增）
Phase 6 ← 所有功能完成後
```

## 預估時間軸（一人開發 + Claude Code 輔助）

| Phase | 預估 |
|-------|------|
| Phase 1：後端部署 | 1-2 天 |
| Phase 2：Flutter 基礎 | 2-3 天 |
| Phase 3：行動 | 3-5 天 |
| Phase 4：日誌 | 5-7 天（富文本是主要風險） |
| Phase 5：卡片 | 3-5 天 |
| Phase 6：收尾 | 3-5 天 |
| **合計** | **約 3-4 週** |

> 注意：日誌的富文本編輯是最大風險。Flutter 生態的富文本方案不如 Web 的 TipTap 成熟，可能需要額外時間評估和調整。

# 卡片圖片區塊（上傳 + `/` 插入 + 區塊拖曳）設計

**Goal:** 卡片內文可以放圖片。三個入口（拖檔進編輯區、剪貼簿貼上、`/` 選「圖片」），圖片是獨立區塊，可以跟文字段落一樣用把手上下拖。

**平台範圍（使用者決定）:** Web + Mac 完整功能；iOS 只顯示（不上傳、不拖）。

**圖檔儲存（使用者決定）:** 先存 Postgres。設計上要讓之後搬 R2 / 物件儲存時卡片內文零改動。

---

## 0. 現況（調查結果，不是設計）

- 「卡片」= `tasks` 表 `description` 非空的 row。內文是 TipTap HTML 字串，整份覆蓋存檔（`PATCH /api/tasks/[id]`，帶 `baseUpdatedAt`，409 衝突機制見 `2026-06-17-card-save-conflict-fix-design.md`）。
- Web：TipTap v3。`/` 選單已存在（`src/components/editor/slash-command-*.ts`，定義檔 `slash-command-defs.ts` 與 Apple 共用）。頂層區塊拖曳已存在（`use-block-drag.ts` + `block-drag-handle.tsx`，原生 HTML5 DnD，不用 library）。**沒有 Image node。**
- Apple：WKWebView 跑離線 TipTap bundle（`apple/NudgeEditor/`），同一份 HTML。Mac 有 `/` 選單（純 DOM `slash-menu.ts`）；iOS 關閉 `/`（WKWebView 吃字 bug）。**bundle 沒有 Image node、沒有拖曳把手。** bridge 訊息：`ready | change | selection | height | focus | openURL`。
- 後端：**沒有任何檔案儲存、上傳 API、附件表。** `PATCH /api/tasks/[id]` 對 `description` 沒有大小上限、沒有 sanitize（DOMPurify 裝了沒用）。
- Flutter 已移除。

---

## 1. 資料與 API

### 1.1 新表 `task_attachments`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | text PK（nanoid，與全 repo 一致） | 內文裡引用的編號 |
| `user_id` | FK users | 擁有者；取圖時檢查 |
| `task_id` | FK tasks, nullable, on delete set null | 上傳時就知道是哪張卡；null = 尚未綁定或卡片已刪 |
| `mime` | text | 只允許 `image/jpeg` `image/png` `image/webp` `image/gif` |
| `bytes` | bytea | 圖檔本體 |
| `size` | integer | bytes 長度 |
| `width` / `height` | integer | 客戶端縮圖後的尺寸，給 `<img>` 預留版面用 |
| `created_at` | text (ISO) | 跟既有表一致 |

Migration 純新增、不動舊欄位 → dev/prod 共用 DB 可直接跑，不用分段部署。

### 1.2 API

| 路由 | 用途 | 規則 |
|---|---|---|
| `POST /api/attachments` | 上傳。multipart：`file`、`taskId` | 需登入（web NextAuth 或 app Bearer，與既有 API 相同）。驗 magic bytes 不信 Content-Type。> 5MB 回 413。回 `{ id, width, height, mime, size }` |
| `GET /api/attachments/[id]` | 取圖 | 需登入且 `user_id` 相符，否則 404（不回 403，避免探測）。回 `Cache-Control: private, max-age=31536000, immutable` + ETag。 |
| `DELETE /api/attachments/[id]` | 刪圖（第一版不接 UI，給清理與未來用） | 擁有者才可 |

**搬家預留**：之後搬 R2 時，`GET` 改成 302 到簽名網址，`POST` 改寫到 R2；內文裡的 `/api/attachments/<id>` 不變。

### 1.3 內文格式

```html
<img src="/api/attachments/8c0e…" data-attachment-id="8c0e…" width="1600" height="1200" alt="">
```

- 頂層區塊（`inline: false`），不允許放在段落裡。
- `src` 是**相對路徑**。Web 直接用；Apple 載入時改寫成自訂 scheme（見 §3），存檔前改回來，保證三邊 HTML 一致。
- 不接受外部網址的 `<img>`（貼上含外站圖片的 HTML 時，把圖片節點丟掉，只留文字）。原因：外站圖會洩漏使用者 IP、也會壞連結。

### 1.4 上限與清理

- **客戶端縮圖**（§2.2）後才上傳；伺服器硬上限 5MB/張。
- `description` 加上限 **1MB**，超過回 413。這是防呆，不是功能。
- **孤兒清理**：`task_attachments` 中「沒有任何 `tasks.description` 含該 id、且 `created_at` 超過 24 小時」的 row 刪除。實作成一支 `scripts/reap-orphan-attachments.mjs`（純 SQL：`NOT EXISTS (… position(a.id in t.description) > 0)`，不用 LIKE 因為 nanoid 含 `_`；有 `--dry-run`；可由 cron 或手動跑），**不**在 PATCH 路徑上做（避免拖慢存檔、避免 409 重試時誤刪）。24 小時緩衝涵蓋「上傳了還沒存檔」與「undo 把圖片拉回來」。
- 刪卡片：`task_id` 設 null，交給清理程序。

---

## 2. Web 編輯器

### 2.1 Image node

- 用 `@tiptap/extension-image`，設 `inline: false, allowBase64: false`，加 `data-attachment-id` / `width` / `height` 屬性。
- 自訂 React node view：
  - 上傳中：顯示本機 `blob:` 預覽 + 轉圈 + 半透明遮罩。
  - 成功：把 `src` 換成 `/api/attachments/<id>`、填 `data-attachment-id`，**不**觸發 undo 歷史（用 `tr.setMeta('addToHistory', false)`）。
  - 失敗：移除該節點，toast 顯示錯誤（新增 i18n key `editor.imageUploadFailed`）。
  - 選取時有外框（用 `--primary` token），Backspace / Delete 可刪。
- 版本要與 Apple bundle **完全相同**（README 既有規則）。

### 2.2 上傳流程（三個入口共用）

```
File → 驗 mime（只收 jpeg/png/webp/gif）
     → 非 gif 走 canvas 縮圖：最長邊 ≤ 2048，輸出 WebP（不支援則 JPEG）品質 0.85
     → gif 不縮（保留動畫），但 > 5MB 直接報錯
     → 立刻插入 node（上傳中狀態，blob 預覽）
     → POST /api/attachments
     → 成功：更新 node；失敗：移除 node + toast
```

放在 `src/lib/image-upload.ts`（純函式，可單測：mime 判斷、尺寸計算）。

### 2.3 三個入口

1. **拖檔**：TipTap `editorProps.handleDrop`。只處理 `dataTransfer.files` 含圖片的情況；其他交回預設（否則會擋掉既有的區塊拖曳，因為兩者都走 HTML5 DnD —— 要用 `event.dataTransfer.types` 區分 `Files` vs 內部拖曳）。插入位置 = `posAtCoords` 落點所在頂層區塊之後。
2. **貼上**：`editorProps.handlePaste`，`clipboardData.files` 有圖片就攔截。
3. **`/` 圖片**：`slash-command-defs.ts` 加 `image` 項（`requiredExtension: "image"`），command 打開隱藏的 `<input type="file" accept="image/*" multiple>`。i18n key：`editor.slashImageLabel / Description / Keywords`（canonical zh-TW + sync + xcstrings 鏡像）。

多檔一次拖入 → 依序各插一個區塊。

### 2.4 區塊拖曳

既有 `use-block-drag.ts` 以頂層 node 為單位，Image 是頂層 node，**理論上不用改**。必須實測（DoD）：
- 圖片拖到兩段文字之間
- 段落拖到圖片上方 / 下方
- 拖曳中滑鼠經過圖片時 drop indicator 正確
- 拖檔上傳的 drop 與區塊拖曳的 drop 不互相干擾
- 重新整理後順序正確

### 2.5 其他顯示點

- 卡片列表預覽 `stripHtml` 會把 `<img>` 剝成空字串。純圖卡片會被 `/api/cards` 的「`stripHtml` 非空」過濾掉 → 該過濾改成「去 HTML 後非空 **或** 含 `<img`」。
- 列表卡片本身第一版不顯示縮圖（不做）。

---

## 3. Apple（Mac 完整、iOS 顯示）

### 3.1 顯示（Mac + iOS 共同，與 Web 同批上線 — 見 §5 風險）

- bundle 加同版本 `@tiptap/extension-image`，同樣屬性。
- **取圖身分**：WKWebView 的 `<img>` 不會帶 Bearer。在 `NudgeKit` 加 `WKURLSchemeHandler`，scheme `nudge-attachment://<id>`，由原生用 `APIClient` 帶 token 下載 `GET /api/attachments/<id>`，回給 webview；原生層做記憶體快取（NSCache），磁碟層靠 URLSession 預設 URLCache（server 回 `Cache-Control: private, max-age=31536000, immutable`，private cache 可存）。
- bundle `load(html)` 時把 `src="/api/attachments/X"` 改寫成 `nudge-attachment://X`；`getHTML()` 與 `change` 訊息前改回相對路徑。這段改寫是純字串函式，放 `apple/NudgeEditor/src/attachment-url.ts`，加 vitest。
- iOS 的 node view：只顯示，不出上傳 UI。

### 3.2 上傳（Mac only）

- bundle 的三個入口與 Web 共用邏輯（縮圖在 bundle 內用 canvas 做，WKWebView 支援）。
- 上傳走 bridge，不在 webview 內 fetch：
  - JS → native：`upload { requestId, taskId, mime, base64 }`
  - native → JS：`NudgeEditor.uploadResult({ requestId, ok, id?, width?, height?, error? })`
- 原生用既有 `APIClient` 打 `POST /api/attachments`。
- Mac 拖檔進 WKWebView：macOS 的 WKWebView 支援 HTML5 file drop，先用 `handleDrop` 試；若 Finder 拖入拿不到 `files`，退路是 `NSViewRepresentable` 加 `registerForDraggedTypes` 轉交 bridge。**先 spike 這一點再動工。**
- `/` 選單的「圖片」項在 Mac 的 DOM 選單直接吃 `SLASH_COMMAND_DEFS`，但開檔案選擇視窗要走 bridge → 原生 `NSOpenPanel`（webview 內的 `<input type=file>` 在 WKWebView 可用，但原生 panel 體驗一致，二擇一，spike 時決定）。
- iOS：`upload` 訊息原生端直接回 `ok:false`；bundle 在 `NUDGE_PLATFORM === "ios"` 時不註冊三個入口。

### 3.3 Mac 拖曳把手

- 把 `use-block-drag.ts` 改寫成不依賴 React 的 `apple/NudgeEditor/src/block-drag.ts`（ProseMirror plugin + 純 DOM 把手）。`posAtCoords`、slot 計算、`tr.delete + insert` 邏輯逐行搬，**不重寫演算法**。
- 只在 `NUDGE_PLATFORM === "macos"` 啟用。
- 樣式用既有 token（bundle 內已有主題變數注入機制 `setTheme`）。

---

## 4. 安全

- `GET /api/attachments/[id]` 回 `Content-Type` 以儲存的 `mime` 為準、加 `X-Content-Type-Options: nosniff`、`Content-Disposition: inline`。
- 上傳驗 magic bytes；SVG 一律拒收（可帶 script）。
- 外站 `<img>` 在編輯器端丟棄（§1.3）。伺服器端 sanitize 整份 HTML **不在本案範圍**，另開一題。

---

## 5. 上線順序與風險

| 批次 | 內容 | 驗收 |
|---|---|---|
| **1** | migration + 三支 API + Web 三入口 + Web node view + **Apple bundle 認得 Image + scheme handler（顯示）** | Web 完整流程；Mac / iOS 開含圖卡片看得到圖；**iOS 編輯含圖卡片存檔後圖片仍在** |
| **2** | Mac 上傳三入口（bridge）+ Mac 拖曳把手 | Mac 實機完整流程 + 把手 DoD 清單 |
| **3** | 孤兒清理 script + `description` 1MB 上限 + `/api/cards` 純圖卡片過濾修正 | 單測 + 手動跑 script |

**資料遺失風險（本案最重要的一條）：** TipTap 載入時會丟掉不認得的 node。若 Web 先上線插圖，而 App 的 bundle 還沒有 Image node，使用者在 iPhone / Mac 打開該卡片改一個字 → 存檔就把圖片從內文刪掉。**所以批次 1 必須包含 App bundle 更新。** 目前產品只有開發者一人使用、尚未對外公布（2026-10-16 使用者決定），因此**不加 feature flag**；Web 上線後、App 新版裝上前，開發者自己避免在舊版 App 編輯含圖卡片即可。對外公布後若要再做類似「新 node 型別」的改動，需重新評估是否加開關。

**部署順序：** migration 純新增 → 先跑 migration 或先上 code 都安全。

---

## 6. 測試

- vitest：`image-upload.ts`（mime 白名單、縮圖目標尺寸）、`attachment-url.ts`（scheme 改寫雙向）、清理 script 的「找出孤兒 id」查詢邏輯（抽成純函式：給 HTML 列表 + 附件 id 列表 → 孤兒集合）。
- API：`POST` 拒 SVG / 超大檔 / 非圖片 magic bytes；`GET` 他人附件回 404。
- 手動（DoD，AGENTS.md 規則）：三入口 × 三平台矩陣、§2.4 拖曳清單、409 衝突後 remount 圖片仍在、重新整理、Mac ⌘Z 可還原刪圖。

---

## 7. 不做（明列）

圖片左右並排 / 欄位、圖片縮放拖拉、圖說、對齊、iOS 上傳與拖曳、影片與一般檔案附件、列表縮圖、伺服器端 HTML sanitize、公開分享連結。

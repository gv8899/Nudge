# Nudge Hosted MCP Server — 方向草稿

> 狀態：**方向草稿**，未排期實作。等到要做時再展開成完整 spec + plan。
> 目的：讓 LLM (Claude.ai / Claude Desktop / Cursor / ChatGPT Connectors / 任何 MCP host) 能直接連 Nudge，零本地安裝、一鍵 OAuth 授權、用自然語言操作任務。

## 目標與非目標

**目標**：
- 使用者在 Claude 一個動作就能連上 Nudge（貼一個 URL → OAuth 授權 → 完成）
- 一份程式碼支援所有 MCP host（不分 Desktop / Web / 第三方）
- 跟 Web / iOS / macOS 共用同一套後端業務邏輯，不重寫

**非目標**（這份草稿不處理）：
- 多租戶 / 組織版授權（先做個人帳號）
- 細粒度 scope 控制（先只有 read / write 兩種）
- LLM 主動 push 通知（user-initiated 為主）

## 架構總覽

```
┌─────────────────────────────┐
│ Claude.ai / Desktop / etc.  │
└────────────┬────────────────┘
             │ HTTPS + Bearer
             ▼
┌─────────────────────────────────────────┐
│ Next.js app (existing nudge.app)        │
│  ├─ /.well-known/oauth-*                │
│  ├─ /api/oauth/{authorize,token,...}    │
│  └─ /api/mcp  ← MCP Streamable HTTP     │
│         │                                │
│         ▼ 內部呼叫，共用 service 層       │
│  ┌──────────────────────────────────┐   │
│  │ Existing /api/tasks 等 API        │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**關鍵決策**：
- MCP transport 用 **Streamable HTTP**（POST 為主），不用 SSE — Vercel serverless 直接 host 沒問題，create/list task 都是短請求
- OAuth server 內嵌在 Next.js app，不另開 service
- 共用既有的 task service 層，MCP 只是另一個 entry point

## 路由清單

| Path | Method | 說明 |
|---|---|---|
| `/.well-known/oauth-protected-resource` | GET | 告訴 client「驗證去 nudge.app/api/oauth」 |
| `/.well-known/oauth-authorization-server` | GET | OAuth 2.1 metadata（authorize/token/jwks URL）|
| `/api/oauth/register` | POST | Dynamic Client Registration (RFC 7591) |
| `/api/oauth/authorize` | GET | 顯示同意頁；user 同意後 redirect 帶 code |
| `/api/oauth/token` | POST | code → access_token / refresh_token |
| `/api/mcp` | POST | MCP Streamable HTTP transport endpoint |

## OAuth Flow（end-to-end）

1. User 在 Claude 加 connector，貼 `https://nudge.app/api/mcp`
2. Claude fetch `/.well-known/oauth-protected-resource` → 找到 auth server URL
3. Claude fetch `/.well-known/oauth-authorization-server` → 拿 endpoints
4. Claude POST `/api/oauth/register` → 拿到 `client_id`（DCR，不用人工註冊）
5. Claude 開瀏覽器到 `/api/oauth/authorize?client_id=...&code_challenge=...&redirect_uri=...`
6. 若 user 還沒登入 Nudge → 走既有 Google sign-in flow，回來繼續
7. 顯示同意頁：「**Claude** 想要存取你的 Nudge 任務（讀取＋寫入）」→ 同意
8. Redirect 回 Claude 帶 `code`
9. Claude POST `/api/oauth/token` 帶 code + code_verifier → 拿 `access_token`（≤1h）+ `refresh_token`（90d）
10. 之後每個 MCP request 帶 `Authorization: Bearer <access_token>`

## Tools（MCP 對外暴露）

第一版（MVP）：
- `create_task(title, description?, dueDate?, recurrence?)`
- `list_tasks(date?, status?, limit?)` — 預設今天
- `get_task(id)`
- `update_task(id, fields)` — 支援 title/description/dueDate
- `complete_task(id)`
- `delete_task(id)`
- `list_today_assignments()` — 對應 Daily 頁

第二版（之後）：
- `add_task_recurrence(id, rrule)`
- `list_overdue()`
- `set_notification(id, time)`
- `search_tasks(query)`

## Data Model 變更

新增 4 張表：

```sql
oauth_clients (
  id            text primary key,        -- DCR 配發
  client_secret text,                    -- public client 為 null
  redirect_uris text[] not null,
  client_name   text,                    -- "Claude", "Cursor"
  created_at    timestamptz default now()
)

oauth_authorization_codes (
  code             text primary key,
  client_id        text references oauth_clients(id),
  user_id          text references users(id),
  redirect_uri     text not null,
  code_challenge   text not null,         -- PKCE (S256)
  scope            text not null,
  expires_at       timestamptz not null   -- 10 分鐘
)

oauth_access_tokens (
  token         text primary key,         -- random 32 bytes，hash 存
  client_id     text references oauth_clients(id),
  user_id       text references users(id),
  scope         text not null,
  expires_at    timestamptz not null      -- 1 小時
)

oauth_refresh_tokens (
  token         text primary key,
  access_token  text,                     -- 對應 active access token，可撤銷
  client_id     text,
  user_id       text,
  expires_at    timestamptz               -- 90 天
)
```

Token 一律以 sha256 hash 形式存 DB；明碼只在發出當下回 client。

## 安全

- **HTTPS only**（已有 nudge.app 證書）
- **PKCE 必填**（S256），不接受 plain
- **Access token TTL 1 小時**，Refresh token TTL 90 天，可主動撤銷
- **Scope**：`tasks:read` / `tasks:write`（同意頁清楚顯示）
- **Rate limit**：per token，例如 60 req/min
- **Audit log**：另存一張 `mcp_audit_logs` 表，記錄 token + tool + timestamp + 結果（先記不展示，之後做設定頁讓使用者看）

## 實作順序（建議分 6 個 milestone，每個獨立可驗證）

**M1 — Bearer token 共用層**（≈2 天）
- `/api/tasks` 等既有 endpoint 加 middleware：同時接受 session cookie 或 `Authorization: Bearer <token>`
- 內部 `getCurrentUser()` 抽出 helper，兩種 auth path 共用
- 寫個臨時 `dev_tokens` 表先頂著（之後 M5 換成 oauth_access_tokens）

**M2 — MCP route + tools 骨架**（≈3 天）
- `app/api/mcp/route.ts`，用 `@modelcontextprotocol/sdk` 的 Streamable HTTP transport
- 實作 7 個 MVP tools，內部呼叫 service 層
- 用 hard-coded token 在 Claude Desktop 跑通

**M3 — OAuth metadata + 基本 flow**（≈4 天）
- `/.well-known/*` endpoints
- `/api/oauth/authorize` + `/api/oauth/token`（先不做 DCR，client 寫死）
- 同意頁 UI（複用 settings modal 風格）
- end-to-end 走通：user 在 Claude 點 connect → 跳 Nudge → 同意 → 回 Claude 拿 token

**M4 — DCR (Dynamic Client Registration)**（≈2 天）
- `/api/oauth/register`
- Public client（無 secret）+ PKCE

**M5 — Refresh + 撤銷 + audit**（≈2 天）
- `/api/oauth/token` 支援 `grant_type=refresh_token`
- Settings 頁加「已連結的應用」清單，可撤銷
- Audit log 寫入

**M6 — 跨平台測試 + 文件**（≈2 天）
- Claude Desktop / Claude.ai / Cursor / ChatGPT 各跑一輪
- 寫使用者教學頁（一張圖示意流程）

**總計**：約 3 週（含測試 + 文件）

## 開發前要先做的決策

實作前要先評估、回答：

1. **要不要用現成 lib？**
   - `@vercel/mcp-adapter` — Vercel 官方，跟 Next.js 整合最好，但 OAuth 部分支援度待確認
   - `mcp-handler` — 較通用
   - 自刻 — 控制最完整，但工時 ×1.5
   - **建議**：M1-M2 先用 lib 跑通，到 M3 OAuth 看 lib 支援度再決定要不要自刻

2. **DB 用既有的還是新 schema？**
   - 既有：方便共用 user 資料
   - 獨立 schema (`oauth.*`)：邏輯隔離，未來抽出去比較容易
   - **傾向**：放既有 DB 但用 `oauth_` 前綴，不獨立 schema

3. **Consent 頁要不要共用 settings modal 元件？**
   - 共用：省工 + 風格一致
   - 獨立：未來改 settings 不會影響 oauth flow
   - **傾向**：獨立 page，共用設計 token 不共用元件

4. **API 命名 convention**
   - 是否需要把現有 `/api/tasks` 移到 `/api/v1/tasks`，留 `/api/tasks` 給 MCP？
   - **傾向**：不移，MCP 跟 Web 共用同一份 API，少一層 indirection

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| OAuth 2.1 規範自己刻容易踩坑（特別是 PKCE / DCR 細節） | M3 之前先 review 1-2 個開源 OAuth server (e.g. Hydra, Lucia) 的實作 |
| Vercel serverless 對長連線不友善 | 用 Streamable HTTP 而不是 SSE，每個 tool call 是獨立短請求 |
| MCP spec 還在演化 | 用官方 SDK 而不是自己 parse JSON-RPC，spec 變只要升 SDK 版本 |
| Token 外洩風險 | TTL 短 + refresh + 撤銷頁 + audit log；明碼只在發出當下回，DB 存 hash |
| 第一次同意頁設計不順（影響 conversion） | M6 找 3-5 個朋友實際走一次流程錄影 |

## 不做的事（明確劃線）

- ❌ 不做 stdio MCP server（直接跳 hosted）
- ❌ 不做 organization / team scope（先個人）
- ❌ 不做 tool 細粒度權限（讀 / 寫兩種就好）
- ❌ 不做 LLM-initiated webhook（只做 user-initiated tool call）
- ❌ 不做 自有 OAuth 第三方串接（只給 MCP client 用，不開放給其他 app）

## 後續展開

決定要做時：
1. 先把這份草稿擴充成完整 spec（補 schema DDL、API request/response 範例、UI 線稿）
2. 用 `superpowers:writing-plans` 拆成 task-level plan
3. 用 `superpowers:subagent-driven-development` 跑 M1 → M6

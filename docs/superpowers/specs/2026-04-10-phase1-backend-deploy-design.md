# Phase 1：後端部署設計

## 摘要

把 Nudge 從本機 SQLite 搬到雲端 PostgreSQL（Zeabur 內建），部署 Next.js，並擴展 Auth 讓未來的 Flutter App 能透過 Bearer JWT 打 API。Web 繼續用 NextAuth session，App 用 JWT，`getUser()` 兩種都認。

## 設計決策

| 項目 | 決定 | 理由 |
|------|------|------|
| PostgreSQL 位置 | Zeabur 內建 service | 同 project，設定最簡單 |
| Drizzle driver | `better-sqlite3` → `pg`（node-postgres） | Drizzle 官方支援，API 一致 |
| Auth 方式 | Web: NextAuth session / App: Bearer JWT | 不動現有 Web 登入，新增 JWT 給 App |
| JWT 簽名 | 用 `AUTH_SECRET`（jose library） | 不另外管 key |
| 資料遷移 | Node.js script: SQLite → PostgreSQL | 一次性，按 FK 順序 |

## 1. 資料庫遷移：SQLite → PostgreSQL

### Dependencies 變更

移除：
- `better-sqlite3`
- `@types/better-sqlite3`（如果有）

新增：
- `pg`
- `@types/pg`（dev）
- `drizzle-orm/pg-core`（已含在 drizzle-orm 裡）

### drizzle.config.ts

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### src/lib/db/schema.ts

全部從 `sqliteTable` 改為 `pgTable`：

```ts
import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull(),
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["inbox", "backlog", "in_progress", "waiting", "done", "archived"],
  }).notNull().default("inbox"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
  remindAt: text("remind_at"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("chart-1"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const taskTags = pgTable("task_tags", {
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
});

export const statusHistory = pgTable("status_history", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedAt: text("changed_at").notNull(),
  note: text("note"),
});

export const dailyTaskAssignments = pgTable("daily_task_assignments", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const dailyNotes = pgTable("daily_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});
```

主要差異：
- `sqliteTable` → `pgTable`
- `integer("is_completed", { mode: "boolean" })` → `boolean("is_completed")`
- 其餘欄位（text, integer）通用，不需改

### src/lib/db/index.ts

全部重寫：

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

移除所有 `initTables` raw SQL 和增量 migration — 改用 `drizzle-kit push` 或 `drizzle-kit migrate` 建表。

### API routes 同步 → 非同步

better-sqlite3 是同步的（`.get()`, `.all()`, `.run()`），pg driver 是非同步的。所有用 `db` 的地方需要加 `await`。

影響的檔案（所有 API routes + getUser）：
- `src/lib/get-user.ts`
- `src/app/api/cards/route.ts`
- `src/app/api/cards/untitled/route.ts`
- `src/app/api/daily/[date]/route.ts`
- `src/app/api/daily/[date]/notes/route.ts`
- `src/app/api/daily/[date]/tasks/route.ts`
- `src/app/api/daily/[date]/tasks/reorder/route.ts`
- `src/app/api/daily/week/route.ts`
- `src/app/api/me/route.ts`
- `src/app/api/tags/route.ts`
- `src/app/api/tags/[id]/route.ts`
- `src/app/api/tasks/route.ts`
- `src/app/api/tasks/[id]/route.ts`
- `src/app/api/tasks/[id]/status/route.ts`
- `src/app/api/tasks/[id]/tags/route.ts`

改法統一：`.get()` → `await ...` (Drizzle pg driver 回傳 Promise)，`.all()` → `await ...`，`.run()` → `await ...`。

Drizzle 的 pg driver 查詢語法幾乎相同，差異只在回傳是 Promise。單筆查詢用 `.then(rows => rows[0])` 或 Drizzle 的 `.limit(1)` 取代 `.get()`。

### 資料遷移 Script

建立 `scripts/migrate-sqlite-to-pg.ts`：

1. 用 `better-sqlite3` 讀本機 `nudge.db`
2. 用 `pg` Client 連 Zeabur PostgreSQL
3. 按 FK 順序 INSERT：
   - users
   - tasks
   - tags
   - task_tags
   - status_history
   - daily_task_assignments
   - daily_notes
4. 用 transaction 確保原子性

執行方式：`npx tsx scripts/migrate-sqlite-to-pg.ts`

## 2. 部署到 Zeabur

### Zeabur Project 設定

- **Service 1：Next.js** — 從 GitHub repo 部署，build command 自動偵測
- **Service 2：PostgreSQL** — Zeabur 內建，自動提供 `DATABASE_URL`

### 環境變數

| 變數 | 來源 |
|------|------|
| `DATABASE_URL` | Zeabur PostgreSQL 自動注入 |
| `AUTH_SECRET` | 手動設（`openssl rand -base64 32`） |
| `AUTH_GOOGLE_ID` | 同本機 `.env.local` |
| `AUTH_GOOGLE_SECRET` | 同本機 `.env.local` |
| `NEXTAUTH_URL` | Zeabur 給的 domain（如 `https://nudge.zeabur.app`） |

### Google OAuth Console

在 Google Cloud Console 的 OAuth 2.0 Client：
- Authorized redirect URIs 加上 `https://<zeabur-domain>/api/auth/callback/google`
- Authorized JavaScript origins 加上 `https://<zeabur-domain>`

### 建表

部署後首次執行 `npx drizzle-kit push` 對 Zeabur PostgreSQL 建表，或在部署腳本中加入。

## 3. Auth 擴展：支援 App 登入

### 新增 `/api/auth/mobile` endpoint

```
POST /api/auth/mobile
Body: { "idToken": "<google-id-token>" }
Response: { "token": "<jwt>", "user": { id, email, name, avatarUrl } }
```

流程：
1. App 端用 Google Sign-In SDK 登入 → 取得 `idToken`
2. POST 到 `/api/auth/mobile`
3. 後端用 Google 的 tokeninfo endpoint 驗證 idToken → 取得 email, name, picture
4. 在 DB 查找 user（by email），沒有就建立（同現有 NextAuth signIn callback 邏輯）
5. 用 `jose` library 簽發 JWT（payload: `{ userId, email }`，exp: 30 天）
6. 回傳 JWT + user 資料

### 修改 `getUser()`

```ts
export async function getUser() {
  // 1. 優先檢查 Bearer token（App）
  const authHeader = headers().get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = await verifyJWT(token); // jose verify
      const user = await db.select().from(users).where(eq(users.email, payload.email)).limit(1);
      return user[0] || null;
    } catch {
      return null;
    }
  }

  // 2. Fallback 到 NextAuth session（Web）
  const session = await auth();
  if (!session?.user?.email) return null;
  // ... 現有邏輯
}
```

### JWT 工具

新增 `src/lib/jwt.ts`：
- `signJWT(payload)` — 用 `AUTH_SECRET` 簽發，30 天到期
- `verifyJWT(token)` — 驗證並回傳 payload

Dependencies 新增：`jose`（輕量 JWT library，比 jsonwebtoken 更好，純 ESM）

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 重寫 | `src/lib/db/index.ts` | pg Pool + drizzle 初始化 |
| 重寫 | `src/lib/db/schema.ts` | pgTable 定義 |
| 修改 | `src/lib/get-user.ts` | 支援 Bearer JWT + NextAuth session |
| 新增 | `src/lib/jwt.ts` | JWT sign / verify |
| 新增 | `src/app/api/auth/mobile/route.ts` | App 登入 endpoint |
| 修改 | `drizzle.config.ts` | dialect: postgresql |
| 修改 | `package.json` | 換 dependencies |
| 修改 | 所有 API routes（15 個檔案） | 同步 → 非同步（加 await） |
| 新增 | `scripts/migrate-sqlite-to-pg.ts` | 資料遷移 script |

## 本機開發

遷移後本機開發也需要 PostgreSQL。兩個選項：

1. **Docker**：`docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16` → `.env.local` 加 `DATABASE_URL=postgresql://postgres:dev@localhost:5432/nudge`
2. **直接連 Zeabur**：開發時連雲端 DB（簡單但有延遲，且改資料影響線上）

建議用 Docker 做本機開發，Zeabur 只用於正式環境。

## 不做

- Flutter App（Phase 2）
- CORS 設定（App 打 API 無 CORS 限制）
- Rate limiting
- Refresh token 機制（JWT 30 天到期，到期後 App 重新 Google 登入）
- WebSocket / 即時同步

## 完成標準

- [ ] Web App 在 Zeabur 正常運行，所有功能和本機一致
- [ ] 現有資料完整遷移到 PostgreSQL
- [ ] 本機用 Docker PostgreSQL 開發正常
- [ ] `POST /api/auth/mobile` 拿到 JWT
- [ ] `curl -H "Authorization: Bearer <jwt>" https://<domain>/api/daily/2026-04-10` 正確回傳
- [ ] 現有 Web 登入（NextAuth）不受影響

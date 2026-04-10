# Phase 1：後端部署實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 Nudge 從本機 SQLite 遷移到 Zeabur 雲端 PostgreSQL，並新增 Bearer JWT Auth 讓 Flutter App 能打 API

**Architecture:** 替換 Drizzle driver（better-sqlite3 → pg），schema 從 sqliteTable 改 pgTable，所有 API routes 加 await（同步→非同步），新增 /api/auth/mobile JWT endpoint，修改 getUser() 同時支援 NextAuth session 和 Bearer JWT。

**Tech Stack:** Next.js 16, Drizzle ORM (pg-core), node-postgres (pg), jose (JWT), Zeabur

---

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 修改 | `package.json` | 換 dependencies |
| 重寫 | `src/lib/db/index.ts` | pg Pool + drizzle 初始化 |
| 重寫 | `src/lib/db/schema.ts` | pgTable 定義 |
| 修改 | `drizzle.config.ts` | dialect: postgresql |
| 新增 | `src/lib/jwt.ts` | JWT sign / verify |
| 修改 | `src/lib/get-user.ts` | 支援 Bearer JWT + NextAuth |
| 修改 | `src/lib/auth.ts` | 同步→非同步 |
| 新增 | `src/app/api/auth/mobile/route.ts` | App 登入 endpoint |
| 修改 | 所有 API routes（14 個檔案） | .get()/.all()/.run() 加 await |
| 新增 | `scripts/migrate-sqlite-to-pg.ts` | 資料遷移 script |

---

### Task 1: Dependencies 替換

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 移除 SQLite dependencies，安裝 PostgreSQL + JWT dependencies**

```bash
npm uninstall better-sqlite3 @types/better-sqlite3
npm install pg jose
npm install -D @types/pg
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: 換 better-sqlite3 → pg + jose"
```

---

### Task 2: Drizzle schema 改 pgTable

**Files:**
- Rewrite: `src/lib/db/schema.ts`
- Modify: `drizzle.config.ts`

- [ ] **Step 1: 重寫 schema.ts**

把整個 `src/lib/db/schema.ts` 替換為：

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
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["inbox", "backlog", "in_progress", "waiting", "done", "archived"],
  })
    .notNull()
    .default("inbox"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
  remindAt: text("remind_at"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("chart-1"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const taskTags = pgTable("task_tags", {
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  tagId: text("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
});

export const statusHistory = pgTable("status_history", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedAt: text("changed_at").notNull(),
  note: text("note"),
});

export const dailyTaskAssignments = pgTable("daily_task_assignments", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const dailyNotes = pgTable("daily_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});
```

- [ ] **Step 2: 修改 drizzle.config.ts**

替換為：

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

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema.ts drizzle.config.ts
git commit -m "feat: schema 改 pgTable + drizzle config 改 postgresql"
```

---

### Task 3: DB 初始化改 pg

**Files:**
- Rewrite: `src/lib/db/index.ts`

- [ ] **Step 1: 重寫 db/index.ts**

替換為：

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/index.ts
git commit -m "feat: db 初始化改用 pg Pool"
```

---

### Task 4: auth.ts 同步→非同步

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: 修改 auth.ts 所有 db 呼叫加 await**

替換整個檔案為：

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      try {
        if (!user.email) return false;

        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        if (!existing) {
          const now = new Date().toISOString();
          await db.insert(users).values({
            id: nanoid(),
            email: user.email,
            name: user.name || null,
            avatarUrl: user.image || null,
            createdAt: now,
          });
        }

        return true;
      } catch (e) {
        console.error("signIn callback error:", e);
        return false;
      }
    },
    async session({ session }) {
      try {
        if (session.user?.email) {
          const [dbUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, session.user.email))
            .limit(1);

          if (dbUser) {
            session.user.id = dbUser.id;
          }
        }
      } catch (e) {
        console.error("session callback error:", e);
      }
      return session;
    },
  },
});
```

**關鍵改法：**
- `.get()` → `const [row] = await db.select()...limit(1)` （解構第一筆）
- `.run()` → `await db.insert()...`（移除 .run()，Drizzle pg 不需要）

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: auth.ts 改非同步 pg 查詢"
```

---

### Task 5: JWT 工具 + getUser() 擴展

**Files:**
- Create: `src/lib/jwt.ts`
- Modify: `src/lib/get-user.ts`

- [ ] **Step 1: 建立 jwt.ts**

```ts
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

export interface JWTPayload {
  userId: string;
  email: string;
}

export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .setIssuedAt()
    .sign(secret);
}

export async function verifyJWT(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JWTPayload;
}
```

- [ ] **Step 2: 重寫 getUser() — 支援 Bearer JWT + NextAuth**

替換 `src/lib/get-user.ts` 為：

```ts
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { verifyJWT } from "@/lib/jwt";

export async function getUser() {
  // 1. 優先檢查 Bearer token（App）
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = await verifyJWT(token);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);
      return user || null;
    } catch {
      return null;
    }
  }

  // 2. Fallback 到 NextAuth session（Web）
  const session = await auth();
  if (!session?.user?.email) return null;

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) {
    const now = new Date().toISOString();
    const newUser = {
      id: nanoid(),
      email: session.user.email,
      name: session.user.name || null,
      avatarUrl: session.user.image || null,
      createdAt: now,
    };
    await db.insert(users).values(newUser);
    user = newUser;
  }

  return user;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/jwt.ts src/lib/get-user.ts
git commit -m "feat: JWT 工具 + getUser 支援 Bearer token"
```

---

### Task 6: App 登入 endpoint

**Files:**
- Create: `src/app/api/auth/mobile/route.ts`

- [ ] **Step 1: 建立 /api/auth/mobile**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { signJWT } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { idToken } = body;

  if (!idToken) {
    return NextResponse.json({ error: "idToken required" }, { status: 400 });
  }

  // 用 Google tokeninfo endpoint 驗證
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const googleUser = await res.json();
  const { email, name, picture } = googleUser;

  if (!email) {
    return NextResponse.json({ error: "No email in token" }, { status: 401 });
  }

  // 查找或建立 user
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    const now = new Date().toISOString();
    const newUser = {
      id: nanoid(),
      email,
      name: name || null,
      avatarUrl: picture || null,
      createdAt: now,
    };
    await db.insert(users).values(newUser);
    user = newUser;
  }

  // 簽發 JWT
  const token = await signJWT({ userId: user.id, email: user.email });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/mobile/route.ts
git commit -m "feat: /api/auth/mobile App 登入 endpoint"
```

---

### Task 7: API routes 同步→非同步（批次 1：cards + tags）

**Files:**
- Modify: `src/app/api/cards/route.ts`
- Modify: `src/app/api/cards/untitled/route.ts`
- Modify: `src/app/api/tags/route.ts`
- Modify: `src/app/api/tags/[id]/route.ts`

- [ ] **Step 1: 逐一修改每個檔案**

對每個檔案進行以下統一改法：

**改法規則（適用所有 API route）：**
1. `.get()` → 移除 `.get()`，改用 `const [row] = await db.select()...limit(1)`
2. `.all()` → 移除 `.all()`，改用 `const rows = await db.select()...`
3. `.run()` → 移除 `.run()`，改用 `await db.insert/update/delete()...`
4. 每個 db 呼叫前面加 `await`

讀取每個檔案，套用上述規則。每個 `.get()` 改為解構 `const [variable] = await ...limit(1)`，每個 `.all()` 改為 `const variable = await ...`，每個 `.run()` 改為 `await ...`（移除 `.run()`）。

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cards/route.ts src/app/api/cards/untitled/route.ts src/app/api/tags/route.ts "src/app/api/tags/[id]/route.ts"
git commit -m "feat: cards + tags API routes 改非同步"
```

---

### Task 8: API routes 同步→非同步（批次 2：tasks）

**Files:**
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/app/api/tasks/[id]/route.ts`
- Modify: `src/app/api/tasks/[id]/status/route.ts`
- Modify: `src/app/api/tasks/[id]/tags/route.ts`

- [ ] **Step 1: 逐一修改每個檔案**

同 Task 7 的改法規則。

- [ ] **Step 2: Commit**

```bash
git add src/app/api/tasks/route.ts "src/app/api/tasks/[id]/route.ts" "src/app/api/tasks/[id]/status/route.ts" "src/app/api/tasks/[id]/tags/route.ts"
git commit -m "feat: tasks API routes 改非同步"
```

---

### Task 9: API routes 同步→非同步（批次 3：daily + notes + me）

**Files:**
- Modify: `src/app/api/daily/[date]/route.ts`
- Modify: `src/app/api/daily/[date]/tasks/route.ts`
- Modify: `src/app/api/daily/[date]/notes/route.ts`
- Modify: `src/app/api/daily/[date]/tasks/reorder/route.ts`
- Modify: `src/app/api/daily/week/route.ts`
- Modify: `src/app/api/notes/feed/route.ts`
- Modify: `src/app/api/me/route.ts`

- [ ] **Step 1: 逐一修改每個檔案**

同 Task 7 的改法規則。`daily/[date]/tasks/route.ts` 是最複雜的（約 15 個 db 呼叫），仔細處理每一個。

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/daily/[date]/route.ts" "src/app/api/daily/[date]/tasks/route.ts" "src/app/api/daily/[date]/notes/route.ts" "src/app/api/daily/[date]/tasks/reorder/route.ts" src/app/api/daily/week/route.ts src/app/api/notes/feed/route.ts src/app/api/me/route.ts
git commit -m "feat: daily + notes + me API routes 改非同步"
```

---

### Task 10: 資料遷移 Script

**Files:**
- Create: `scripts/migrate-sqlite-to-pg.ts`

- [ ] **Step 1: 建立遷移 script**

```ts
import Database from "better-sqlite3";
import { Pool } from "pg";

const SQLITE_PATH = process.env.SQLITE_PATH || "./nudge.db";
const PG_URL = process.env.DATABASE_URL;

if (!PG_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const pool = new Pool({ connectionString: PG_URL });

const TABLES = [
  "users",
  "tasks",
  "tags",
  "task_tags",
  "status_history",
  "daily_task_assignments",
  "daily_notes",
] as const;

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const table of TABLES) {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
      console.log(`${table}: ${rows.length} rows`);

      if (rows.length === 0) continue;

      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row).map((v) => {
          // SQLite boolean (0/1) → PostgreSQL boolean
          if (table === "daily_task_assignments" && typeof v === "number" && (v === 0 || v === 1)) {
            return v === 1;
          }
          return v;
        });
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
        const columnNames = columns.map((c) => `"${c}"`).join(", ");

        await client.query(
          `INSERT INTO "${table}" (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
      }
    }

    await client.query("COMMIT");
    console.log("Migration complete!");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", e);
    throw e;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

migrate();
```

注意：這個 script 需要 `better-sqlite3` 在 devDependencies 裡（已被移除）。改法：先 reinstall 為 devDep 跑 migration，跑完再移除。或者在跑 migration 前臨時安裝：

```bash
npm install -D better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migrate-sqlite-to-pg.ts
git commit -m "feat: SQLite → PostgreSQL 資料遷移 script"
```

---

### Task 11: 本機 Docker PostgreSQL + .env 設定

- [ ] **Step 1: 啟動本機 PostgreSQL**

```bash
docker run -d --name nudge-pg -p 5432:5432 -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=nudge postgres:16
```

- [ ] **Step 2: 設定 .env.local**

在 `.env.local` 加入：

```
DATABASE_URL=postgresql://postgres:dev@localhost:5432/nudge
```

保留原有的 `AUTH_SECRET`、`AUTH_GOOGLE_ID`、`AUTH_GOOGLE_SECRET`。

- [ ] **Step 3: 用 drizzle-kit 建表**

```bash
npx drizzle-kit push
```

- [ ] **Step 4: 遷移資料**

```bash
npm install -D better-sqlite3 @types/better-sqlite3
npx tsx scripts/migrate-sqlite-to-pg.ts
npm uninstall better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 5: Build 驗證**

```bash
npx next build
```

- [ ] **Step 6: 啟動 dev server 測試**

```bash
npm run dev
```

手動測試：
1. 開瀏覽器登入 → 看到任務列表 → 資料正確
2. 新增任務 → 完成 → 排序 → 正常
3. 日誌 → 編輯 → 儲存 → 正常
4. 卡片 → list/grid/kanban → tag → 正常
5. 設定 → 標籤管理 → 正常

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: 本機 PostgreSQL 開發環境設定完成"
```

---

### Task 12: 部署到 Zeabur + 測試 App Auth

- [ ] **Step 1: Zeabur 設定**

1. Zeabur Dashboard → 建立 project
2. 加入 PostgreSQL service → 記下 `DATABASE_URL`
3. 加入 Next.js service → 連結 GitHub repo
4. 設定環境變數：
   - `DATABASE_URL`（Zeabur 自動注入）
   - `AUTH_SECRET`（`openssl rand -base64 32`）
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`
   - `NEXTAUTH_URL`（Zeabur 給的 domain）

- [ ] **Step 2: Google OAuth Console 加白名單**

在 Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client：
- Authorized redirect URIs 加 `https://<zeabur-domain>/api/auth/callback/google`
- Authorized JavaScript origins 加 `https://<zeabur-domain>`

- [ ] **Step 3: 建表 + 遷移資料**

用 Zeabur 的 PostgreSQL connection string：

```bash
DATABASE_URL=<zeabur-pg-url> npx drizzle-kit push
npm install -D better-sqlite3 @types/better-sqlite3
DATABASE_URL=<zeabur-pg-url> npx tsx scripts/migrate-sqlite-to-pg.ts
npm uninstall better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 4: 測試 Web 登入**

開瀏覽器訪問 Zeabur domain → Google 登入 → 確認功能正常

- [ ] **Step 5: 測試 App Auth endpoint**

```bash
curl -X POST https://<zeabur-domain>/api/auth/mobile \
  -H "Content-Type: application/json" \
  -d '{"idToken": "<test-google-id-token>"}'
```

（需要一個有效的 Google idToken，可以從瀏覽器 console 取得）

取得 JWT 後測試：

```bash
curl -H "Authorization: Bearer <jwt>" https://<zeabur-domain>/api/daily/2026-04-10
```

預期：回傳當天任務資料。

- [ ] **Step 6: 最終 commit + push**

```bash
git add -A
git commit -m "feat: Phase 1 完成 — PostgreSQL + Zeabur + App Auth"
git push
```

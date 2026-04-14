# Google Calendar Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓使用者在 Nudge 的 Tasks 頁看到當天 Google Calendar 事件（唯讀），並可點擊 inline 展開細節；web + mobile 共用後端。

**Architecture:** Next.js 後端新增 `/api/calendar/*` 路由處理 OAuth 授權、token 加密儲存、Google API 呼叫。Web 前端用 SWR hook + 一個 `<CalendarPanel>` 元件嵌在 Tasks 頁左側。Mobile 用 Riverpod provider 抓同一個後端，提供收合/展開的薄橫幅。Tokens 用 AES-256-GCM 加密存在 `users` 表。

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (Postgres), NextAuth v5 (既有 Google provider), SWR, Vitest, Flutter + Riverpod + Dio, Google Calendar API v3.

**Spec:** `docs/superpowers/specs/2026-04-14-google-calendar-integration-design.md`

---

## File Structure

### New files

**Backend lib**
- `src/lib/google-calendar/crypto.ts` — AES-256-GCM encrypt/decrypt
- `src/lib/google-calendar/oauth.ts` — OAuth URL、token exchange、token refresh
- `src/lib/google-calendar/api.ts` — Google Calendar API 呼叫封裝
- `src/lib/google-calendar/types.ts` — 後端回傳的 Event/Calendar TS types

**Backend API routes**
- `src/app/api/calendar/connect/route.ts`
- `src/app/api/calendar/callback/route.ts`
- `src/app/api/calendar/disconnect/route.ts`
- `src/app/api/calendar/events/route.ts`
- `src/app/api/calendar/calendars/route.ts`

**Web UI**
- `src/hooks/use-calendar-events.ts` — SWR hook
- `src/components/calendar/calendar-panel.tsx` — 左側面板主容器
- `src/components/calendar/calendar-event-item.tsx` — 單一事件 + inline expand
- `src/components/calendar/calendar-empty-state.tsx` — 未連結 / 無事件 / 錯誤
- `src/components/settings/calendar-section.tsx` — 設定頁新區塊

**Mobile**
- `mobile/lib/features/calendar/calendar_models.dart`
- `mobile/lib/features/calendar/calendar_repository.dart`
- `mobile/lib/features/calendar/calendar_provider.dart`
- `mobile/lib/features/calendar/calendar_strip.dart`
- `mobile/lib/features/calendar/calendar_event_tile.dart`

**Tests**
- `src/lib/google-calendar/crypto.test.ts`
- `src/lib/google-calendar/oauth.test.ts`

### Modified files

- `src/lib/db/schema.ts` — `users` 表新增 4 個欄位
- `drizzle/` — 新 migration SQL（`drizzle-kit generate` 產出）
- `src/app/[locale]/(app)/day/[date]/page.tsx` — 引入 `<CalendarPanel>`
- `src/components/settings/settings-modal.tsx` — 引入 `<CalendarSection>`
- `i18n/canonical/zh-TW.json`、`en.json`、`ja.json` — 新 `calendar` 命名空間
- `src/messages/*.json` — 由 `npm run i18n:sync` 自動產出
- `mobile/lib/l10n/app_zh.arb`、`app_en.arb`、`app_ja.arb` — 新 calendar keys
- `mobile/lib/l10n/app_localizations*.dart` — 由 `flutter gen-l10n` 自動產出
- `mobile/lib/features/tasks/tasks_screen.dart` — 週曆 bar 下方放 `CalendarStrip`
- `mobile/lib/features/settings/settings_screen.dart` — 加入日曆區塊
- `vitest.config.ts`（如無則建立）— 加上 `src/**/*.test.ts` 掃描
- `.env.example` — 新增 `GOOGLE_CALENDAR_REDIRECT_URI`、`CALENDAR_TOKEN_KEY`

---

## Prerequisites

本計畫假設：
1. 使用者已準備好 Google Cloud Console 的 OAuth 2.0 client（既有的 Sign in with Google 用的那一個即可），在 consent screen 加上 scope `https://www.googleapis.com/auth/calendar.readonly`，在 Authorized redirect URIs 加入 `http://localhost:3000/api/calendar/callback` 和線上的完整 URL。這步驟**不在程式碼裡**，屬於環境設定。
2. 本機已有 `.env.local` 包含 `DATABASE_URL`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`NEXTAUTH_SECRET`。
3. 專案 `npm run dev` 和 `flutter run` 都能正常跑。

---

## Task 0: Vitest setup for src/

檢查專案是否已有 `vitest.config.ts` 可以跑 `src/` 下的測試。目前 `i18n:test` 只跑 `i18n/scripts` 下的測試。這個計畫的幾個單元測試要在 `src/lib/google-calendar/*.test.ts`，需要能跑。

**Files:**
- Create or modify: `vitest.config.ts`
- Modify: `package.json`（加一個 `test` script）

- [ ] **Step 1: 檢查現況**

Run: `ls vitest.config.* 2>/dev/null && cat vitest.config.*`
Expected: 可能不存在；如果存在，讀內容確認 `include` 有沒有涵蓋 `src/**/*.test.ts`。

- [ ] **Step 2: 建立 vitest.config.ts（如無）**

若沒有或沒涵蓋 `src/`：

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "i18n/scripts/**/*.test.mjs"],
  },
});
```

如果 `vite-tsconfig-paths` 尚未安裝：

Run: `npm install --save-dev vite-tsconfig-paths`

- [ ] **Step 3: 新增 test script**

修改 `package.json` 的 `scripts` 區塊，加入：

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 驗證現有測試還會跑**

Run: `npm test`
Expected: `i18n/scripts/lib/*.test.mjs` 的測試通過，沒有 `src/**/*.test.ts` 被匹配到（目前沒有這類檔案）。

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest config for src tests"
```

---

## Task 1: DB schema — users 表加 4 個 calendar 欄位

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/XXXX_calendar_tokens.sql`（由 drizzle-kit 產出，檔名不同）

- [ ] **Step 1: 修改 schema**

在 `src/lib/db/schema.ts` 的 `users = pgTable(...)` 定義裡，`createdAt` 之後加上：

```ts
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  locale: text("locale"),
  createdAt: text("created_at").notNull(),
  // Google Calendar integration
  googleCalendarAccessToken: text("google_calendar_access_token"),
  googleCalendarRefreshToken: text("google_calendar_refresh_token"),
  googleCalendarTokenExpires: text("google_calendar_token_expires"),
  googleCalendarSelectedIds: text("google_calendar_selected_ids"),
});
```

- [ ] **Step 2: 產生 migration**

Run: `npx drizzle-kit generate`
Expected: `drizzle/` 下新增一個 SQL 檔（檔名由工具決定，例如 `0002_something.sql`），內容包含四個 `ALTER TABLE "users" ADD COLUMN ...` 語句。

- [ ] **Step 3: 確認 SQL 正確**

Run: `cat drizzle/000*_*.sql | tail -20`
Expected: 四個 ADD COLUMN 都是 nullable（沒 `NOT NULL`）。

- [ ] **Step 4: 套用 migration 到本機 DB**

Run: `npx drizzle-kit migrate`
Expected: 顯示 `Applied` 訊息；本機 DB 的 `users` 表已有新欄位。

可用 psql 驗證：
```
psql $DATABASE_URL -c "\d users"
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat(db): add calendar token columns to users"
```

---

## Task 2: Crypto module — AES-256-GCM encrypt/decrypt

**Files:**
- Create: `src/lib/google-calendar/crypto.ts`
- Create: `src/lib/google-calendar/crypto.test.ts`
- Modify: `.env.example` — 加 `CALENDAR_TOKEN_KEY`

- [ ] **Step 1: 寫失敗的測試**

Create `src/lib/google-calendar/crypto.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { encrypt, decrypt } from "./crypto";

beforeAll(() => {
  // 32-byte key, base64
  process.env.CALENDAR_TOKEN_KEY = randomBytes(32).toString("base64");
});

describe("calendar token crypto", () => {
  it("encrypt then decrypt returns original plaintext", () => {
    const plaintext = "ya29.a0AfH6SMB-fake-token";
    const stored = encrypt(plaintext);
    expect(stored).not.toBe(plaintext);
    expect(stored).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
    expect(decrypt(stored)).toBe(plaintext);
  });

  it("different encryptions of same input produce different ciphertexts (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("decrypt throws on tampered ciphertext", () => {
    const stored = encrypt("original");
    const [iv, tag, ct] = stored.split(".");
    const tampered = `${iv}.${tag}.${ct.slice(0, -4)}AAAA`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("decrypt throws on wrong format", () => {
    expect(() => decrypt("not-a-valid-token")).toThrow();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test src/lib/google-calendar/crypto.test.ts`
Expected: FAIL — `Cannot find module './crypto'`

- [ ] **Step 3: 實作 crypto 模組**

Create `src/lib/google-calendar/crypto.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended

function getKey(): Buffer {
  const raw = process.env.CALENDAR_TOKEN_KEY;
  if (!raw) {
    throw new Error("CALENDAR_TOKEN_KEY env var is required");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `CALENDAR_TOKEN_KEY must be 32 bytes (base64); got ${key.length}`
    );
  }
  return key;
}

/**
 * 加密明文，輸出格式 "iv.tag.ciphertext"（全部 base64）。
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

/**
 * 解密 encrypt 產生的字串，失敗會拋 Error。
 */
export function decrypt(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString("utf8");
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test src/lib/google-calendar/crypto.test.ts`
Expected: PASS 4/4

- [ ] **Step 5: 更新 .env.example**

加一行到 `.env.example`：

```
# 32-byte base64 key for encrypting Google Calendar tokens at rest
# Generate with: openssl rand -base64 32
CALENDAR_TOKEN_KEY=
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/calendar/callback
```

- [ ] **Step 6: 產生本機 key 寫進 .env.local**

Run: `echo "CALENDAR_TOKEN_KEY=$(openssl rand -base64 32)" >> .env.local && echo "GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/calendar/callback" >> .env.local`

- [ ] **Step 7: Commit**

```bash
git add src/lib/google-calendar/crypto.ts src/lib/google-calendar/crypto.test.ts .env.example
git commit -m "feat(calendar): AES-256-GCM token crypto"
```

---

## Task 3: OAuth module — buildAuthUrl / exchangeCode / refreshAccessToken

**Files:**
- Create: `src/lib/google-calendar/oauth.ts`
- Create: `src/lib/google-calendar/oauth.test.ts`

- [ ] **Step 1: 寫失敗的測試**

Create `src/lib/google-calendar/oauth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildAuthUrl, exchangeCode, refreshAccessToken } from "./oauth";

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_CALENDAR_REDIRECT_URI = "http://localhost:3000/api/calendar/callback";
  vi.restoreAllMocks();
});

describe("buildAuthUrl", () => {
  it("contains all required params", () => {
    const url = buildAuthUrl("state-abc");
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fcalendar%2Fcallback");
    expect(url).toContain("scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
    expect(url).toContain("state=state-abc");
    expect(url).toContain("response_type=code");
  });
});

describe("exchangeCode", () => {
  it("calls google token endpoint and returns tokens", async () => {
    const mockResponse = {
      access_token: "at-1",
      refresh_token: "rt-1",
      expires_in: 3600,
      token_type: "Bearer",
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );
    const result = await exchangeCode("auth-code-xyz");
    expect(result.accessToken).toBe("at-1");
    expect(result.refreshToken).toBe("rt-1");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws on non-200 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
    );
    await expect(exchangeCode("bad-code")).rejects.toThrow(/invalid_grant/);
  });
});

describe("refreshAccessToken", () => {
  it("returns new access_token and expires", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "at-new", expires_in: 3600, token_type: "Bearer" }),
        { status: 200 }
      )
    );
    const result = await refreshAccessToken("rt-existing");
    expect(result.accessToken).toBe("at-new");
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it("throws on 400 invalid_grant", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
    );
    await expect(refreshAccessToken("rt-bad")).rejects.toThrow(/invalid_grant/);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test src/lib/google-calendar/oauth.test.ts`
Expected: FAIL — `Cannot find module './oauth'`

- [ ] **Step 3: 實作 oauth 模組**

Create `src/lib/google-calendar/oauth.ts`:

```ts
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is required`);
  return v;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: envOrThrow("GOOGLE_CLIENT_ID"),
    redirect_uri: envOrThrow("GOOGLE_CALENDAR_REDIRECT_URI"),
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface ExchangeResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export async function exchangeCode(code: string): Promise<ExchangeResult> {
  const body = new URLSearchParams({
    code,
    client_id: envOrThrow("GOOGLE_CLIENT_ID"),
    client_secret: envOrThrow("GOOGLE_CLIENT_SECRET"),
    redirect_uri: envOrThrow("GOOGLE_CALENDAR_REDIRECT_URI"),
    grant_type: "authorization_code",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Google OAuth exchange failed: ${json.error || res.status}`);
  }
  if (!json.refresh_token) {
    throw new Error("No refresh_token returned; did you set access_type=offline and prompt=consent?");
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
  };
}

export interface RefreshResult {
  accessToken: string;
  expiresAt: Date;
}

export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: envOrThrow("GOOGLE_CLIENT_ID"),
    client_secret: envOrThrow("GOOGLE_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Google OAuth refresh failed: ${json.error || res.status}`);
  }

  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test src/lib/google-calendar/oauth.test.ts`
Expected: PASS 5/5

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-calendar/oauth.ts src/lib/google-calendar/oauth.test.ts
git commit -m "feat(calendar): OAuth URL + token exchange/refresh"
```

---

## Task 4: Google Calendar API 呼叫封裝 + types

**Files:**
- Create: `src/lib/google-calendar/api.ts`
- Create: `src/lib/google-calendar/types.ts`

無單元測試（薄包裝，shape 轉換靠 TS types + 人工 QA）。

- [ ] **Step 1: 定義 types**

Create `src/lib/google-calendar/types.ts`:

```ts
/** 後端回給前端的統一事件 shape */
export interface CalendarEvent {
  id: string;
  calendarId: string;
  calendarName: string;
  title: string;
  /** ISO string in event's timezone */
  start: string;
  /** ISO string in event's timezone */
  end: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
  attendees: string[];
  /** Google Calendar 事件網頁連結 */
  htmlLink: string;
  /** 是否為 private / busy-only（沒有細節可顯示） */
  busyOnly: boolean;
}

/** 後端回給前端的日曆清單 item */
export interface CalendarListItem {
  id: string;
  summary: string;
  backgroundColor: string | null;
  primary: boolean;
}

/** /api/calendar/events response */
export type EventsResponse =
  | { connected: true; events: CalendarEvent[] }
  | { connected: false; reason?: "reauth_required" };

/** /api/calendar/calendars GET response */
export interface CalendarsResponse {
  calendars: CalendarListItem[];
  selectedIds: string[];
}
```

- [ ] **Step 2: 實作 api.ts**

Create `src/lib/google-calendar/api.ts`:

```ts
import type { CalendarEvent, CalendarListItem } from "./types";

const BASE = "https://www.googleapis.com/calendar/v3";

async function callGoogle<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

interface GoogleCalendarListResp {
  items: Array<{
    id: string;
    summary: string;
    backgroundColor?: string;
    primary?: boolean;
  }>;
}

export async function listCalendars(
  accessToken: string
): Promise<CalendarListItem[]> {
  const json = await callGoogle<GoogleCalendarListResp>(
    accessToken,
    "/users/me/calendarList?minAccessRole=reader"
  );
  return (json.items || []).map((c) => ({
    id: c.id,
    summary: c.summary,
    backgroundColor: c.backgroundColor || null,
    primary: c.primary === true,
  }));
}

interface GoogleEventsResp {
  items: Array<{
    id: string;
    status?: string;
    summary?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    location?: string;
    description?: string;
    attendees?: Array<{ email?: string; displayName?: string }>;
    htmlLink?: string;
    visibility?: string;
  }>;
}

export async function listEvents(
  accessToken: string,
  calendarId: string,
  calendarName: string,
  timeMinIso: string,
  timeMaxIso: string
): Promise<CalendarEvent[]> {
  const qs = new URLSearchParams({
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
    showDeleted: "false",
  });
  const json = await callGoogle<GoogleEventsResp>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${qs}`
  );

  return (json.items || [])
    .filter((e) => e.status !== "cancelled")
    .map((e) => {
      const allDay = !!e.start?.date && !e.start?.dateTime;
      const start = e.start?.dateTime ?? e.start?.date ?? "";
      const end = e.end?.dateTime ?? e.end?.date ?? "";
      const busyOnly = e.visibility === "private" || e.visibility === "confidential";
      return {
        id: e.id,
        calendarId,
        calendarName,
        title: busyOnly ? "忙碌" : e.summary ?? "(No title)",
        start,
        end,
        allDay,
        location: busyOnly ? null : e.location ?? null,
        description: busyOnly ? null : e.description ?? null,
        attendees: busyOnly
          ? []
          : (e.attendees ?? []).map((a) => a.displayName || a.email || "").filter(Boolean),
        htmlLink: e.htmlLink ?? "",
        busyOnly,
      };
    });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `src/lib/google-calendar/*`

- [ ] **Step 4: Commit**

```bash
git add src/lib/google-calendar/api.ts src/lib/google-calendar/types.ts
git commit -m "feat(calendar): Google Calendar API wrapper + types"
```

---

## Task 5: `/api/calendar/connect` route

產生 OAuth URL、state 透過 cookie 傳遞、轉址到 Google。

**Files:**
- Create: `src/app/api/calendar/connect/route.ts`

- [ ] **Step 1: 實作 route**

Create `src/app/api/calendar/connect/route.ts`:

```ts
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { buildAuthUrl } from "@/lib/google-calendar/oauth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  }

  const state = randomBytes(24).toString("hex");
  const url = buildAuthUrl(state);

  const response = NextResponse.redirect(url);
  // state 存在 httpOnly cookie 裡，callback 驗證
  response.cookies.set("calendar_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/calendar",
    maxAge: 600, // 10 分鐘
  });
  return response;
}
```

- [ ] **Step 2: 手動驗證**

啟動 dev server：`npm run dev`

在瀏覽器打開 `http://localhost:3000/api/calendar/connect`（需先登入）。
Expected: 瀏覽器被轉址到 `https://accounts.google.com/o/oauth2/v2/auth?...`，URL 含 `scope=...calendar.readonly`、`prompt=consent`、`state=` 和 64 個 hex 字元。

**先不要完成授權**（還沒 callback 路由）。按瀏覽器上一頁回來。

檢查 DevTools Application → Cookies → `calendar_oauth_state` 應該存在。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/calendar/connect/route.ts
git commit -m "feat(calendar): /api/calendar/connect route"
```

---

## Task 6: `/api/calendar/callback` route

收 code、驗 state、換 token、加密存 DB、轉回設定頁。

**Files:**
- Create: `src/app/api/calendar/callback/route.ts`

- [ ] **Step 1: 實作 route**

Create `src/app/api/calendar/callback/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { exchangeCode } from "@/lib/google-calendar/oauth";
import { encrypt } from "@/lib/google-calendar/crypto";

function errorRedirect(reason: string) {
  const url = new URL("/settings", process.env.NEXTAUTH_URL || "http://localhost:3000");
  url.searchParams.set("calendar", "error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000")
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("calendar_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return errorRedirect("invalid_state");
  }

  try {
    const tokens = await exchangeCode(code);
    await db
      .update(users)
      .set({
        googleCalendarAccessToken: encrypt(tokens.accessToken),
        googleCalendarRefreshToken: encrypt(tokens.refreshToken),
        googleCalendarTokenExpires: tokens.expiresAt.toISOString(),
        googleCalendarSelectedIds: JSON.stringify(["primary"]),
      })
      .where(eq(users.id, session.user.id));
  } catch (e) {
    console.error("calendar callback exchange failed:", e);
    return errorRedirect("exchange_failed");
  }

  const url = new URL("/settings", process.env.NEXTAUTH_URL || "http://localhost:3000");
  url.searchParams.set("calendar", "connected");
  const res = NextResponse.redirect(url);
  res.cookies.delete("calendar_oauth_state");
  return res;
}
```

- [ ] **Step 2: 手動驗證整條 OAuth 流程**

Run: `npm run dev`

1. 瀏覽器登入 Nudge
2. 打開 `http://localhost:3000/api/calendar/connect`
3. 在 Google 同意畫面按「允許」
4. 應該被轉回 `http://localhost:3000/settings?calendar=connected`
5. 用 psql 檢查：
   ```
   psql $DATABASE_URL -c "SELECT google_calendar_access_token IS NOT NULL, google_calendar_refresh_token IS NOT NULL, google_calendar_token_expires, google_calendar_selected_ids FROM users WHERE email = 'YOUR-EMAIL'"
   ```
   Expected: 兩個 `t`、到期時間是未來 1 小時內、selected_ids 是 `["primary"]`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/calendar/callback/route.ts
git commit -m "feat(calendar): /api/calendar/callback OAuth completion"
```

---

## Task 7: `/api/calendar/disconnect` route

**Files:**
- Create: `src/app/api/calendar/disconnect/route.ts`

- [ ] **Step 1: 實作**

Create `src/app/api/calendar/disconnect/route.ts`:

```ts
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(users)
    .set({
      googleCalendarAccessToken: null,
      googleCalendarRefreshToken: null,
      googleCalendarTokenExpires: null,
      googleCalendarSelectedIds: null,
    })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ connected: false });
}
```

- [ ] **Step 2: 手動驗證**

```bash
curl -X POST http://localhost:3000/api/calendar/disconnect \
  -H "Cookie: <your-session-cookie>"
```
Expected: `{"connected":false}`

然後用 psql 驗證四個欄位都變 null。**驗證後請重新執行 Task 6 Step 2 重新連結一次**，後續任務需要已連結的狀態。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/calendar/disconnect/route.ts
git commit -m "feat(calendar): /api/calendar/disconnect route"
```

---

## Task 8: Token 取用 helper（含 auto refresh）

在 `/api/calendar/events` 和 `/api/calendar/calendars` 都需要取得一個有效 access_token。抽成共用 helper，避免重複。

**Files:**
- Create: `src/lib/google-calendar/tokens.ts`

- [ ] **Step 1: 實作**

Create `src/lib/google-calendar/tokens.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { decrypt, encrypt } from "./crypto";
import { refreshAccessToken } from "./oauth";

/** 回傳狀態：ok / 未連結 / 需重新授權 */
export type TokenResult =
  | { status: "ok"; accessToken: string; selectedIds: string[] }
  | { status: "not_connected" }
  | { status: "reauth_required" };

const REFRESH_MARGIN_MS = 60_000; // 過期前 60s 就主動 refresh

/**
 * 取得使用者目前可用的 access_token，必要時自動 refresh 並寫回 DB。
 * refresh_token 失效時會清掉 DB 四個欄位並回傳 reauth_required。
 */
export async function getAccessToken(userId: string): Promise<TokenResult> {
  const [row] = await db
    .select({
      access: users.googleCalendarAccessToken,
      refresh: users.googleCalendarRefreshToken,
      expires: users.googleCalendarTokenExpires,
      selected: users.googleCalendarSelectedIds,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || !row.access || !row.refresh || !row.expires) {
    return { status: "not_connected" };
  }

  let accessToken: string;
  try {
    accessToken = decrypt(row.access);
  } catch {
    return { status: "reauth_required" };
  }

  const expiresAt = new Date(row.expires).getTime();
  if (expiresAt - Date.now() < REFRESH_MARGIN_MS) {
    // 需要 refresh
    let refreshToken: string;
    try {
      refreshToken = decrypt(row.refresh);
    } catch {
      return { status: "reauth_required" };
    }
    try {
      const result = await refreshAccessToken(refreshToken);
      accessToken = result.accessToken;
      await db
        .update(users)
        .set({
          googleCalendarAccessToken: encrypt(result.accessToken),
          googleCalendarTokenExpires: result.expiresAt.toISOString(),
        })
        .where(eq(users.id, userId));
    } catch (e) {
      console.error("refresh failed, clearing tokens:", e);
      await db
        .update(users)
        .set({
          googleCalendarAccessToken: null,
          googleCalendarRefreshToken: null,
          googleCalendarTokenExpires: null,
        })
        .where(eq(users.id, userId));
      return { status: "reauth_required" };
    }
  }

  let selectedIds: string[];
  try {
    selectedIds = row.selected ? JSON.parse(row.selected) : ["primary"];
  } catch {
    selectedIds = ["primary"];
  }
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
    selectedIds = ["primary"];
  }

  return { status: "ok", accessToken, selectedIds };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/google-calendar/tokens.ts
git commit -m "feat(calendar): token helper with auto-refresh"
```

---

## Task 9: `/api/calendar/events` route

**Files:**
- Create: `src/app/api/calendar/events/route.ts`

- [ ] **Step 1: 實作**

Create `src/app/api/calendar/events/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAccessToken } from "@/lib/google-calendar/tokens";
import { listEvents, listCalendars } from "@/lib/google-calendar/api";
import type { EventsResponse, CalendarEvent } from "@/lib/google-calendar/types";

function computeDayRange(dateStr: string, tz: string): { min: string; max: string } {
  // dateStr is "YYYY-MM-DD" in user's tz. Build midnight-to-midnight in that tz.
  // Use Intl to figure out the UTC instant corresponding to local midnight.
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) throw new Error("Invalid date");
  const [y, m, d] = parts;
  // Local midnight start
  const startLocal = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  // Adjust for tz offset — crude but sufficient for passing to Google API
  // Google Calendar accepts any valid RFC3339; we pass start/end as tz-qualified.
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${y}-${pad(m)}-${pad(d)}`;
  // Build ISO with tz name embedded by using toLocaleString + offset
  // Simpler: just pass YYYY-MM-DDT00:00:00 + tz offset string computed via Intl
  const tzOffset = getTzOffsetString(tz, startLocal);
  return {
    min: `${ymd}T00:00:00${tzOffset}`,
    max: `${ymd}T23:59:59${tzOffset}`,
  };
}

function getTzOffsetString(tz: string, date: Date): string {
  // Returns e.g. "+08:00" for Asia/Taipei
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  });
  const parts = dtf.formatToParts(date);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+00:00";
  // offsetPart like "GMT+08:00" or "GMT-05:00" or "GMT"
  const match = offsetPart.match(/GMT([+-]\d{2}:\d{2})?/);
  return match?.[1] || "+00:00";
}

export async function GET(req: NextRequest): Promise<NextResponse<EventsResponse | { error: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateStr = req.nextUrl.searchParams.get("date");
  const tz = req.nextUrl.searchParams.get("tz") || "UTC";
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const tokenResult = await getAccessToken(session.user.id);
  if (tokenResult.status === "not_connected") {
    return NextResponse.json({ connected: false } as EventsResponse);
  }
  if (tokenResult.status === "reauth_required") {
    return NextResponse.json({ connected: false, reason: "reauth_required" } as EventsResponse);
  }

  let range: { min: string; max: string };
  try {
    range = computeDayRange(dateStr, tz);
  } catch {
    return NextResponse.json({ error: "Invalid date/tz" }, { status: 400 });
  }

  // 先取得子日曆清單（需要名稱 + 顏色供 event 填充）
  let allCalendars;
  try {
    allCalendars = await listCalendars(tokenResult.accessToken);
  } catch (e) {
    console.error("listCalendars failed:", e);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const nameMap = new Map(allCalendars.map((c) => [c.id, c.summary]));

  const results = await Promise.allSettled(
    tokenResult.selectedIds.map((id) =>
      listEvents(tokenResult.accessToken, id, nameMap.get(id) || id, range.min, range.max)
    )
  );

  const events: CalendarEvent[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      events.push(...r.value);
    } else {
      console.error("listEvents failed:", r.reason);
    }
  }
  // 如果每個都失敗，回 500
  if (events.length === 0 && results.every((r) => r.status === "rejected")) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  // 依開始時間排序，all-day 先排
  events.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.start.localeCompare(b.start);
  });

  return NextResponse.json({ connected: true, events } as EventsResponse);
}
```

- [ ] **Step 2: 手動驗證**

先確保 Task 6 已完成連結。然後：

```bash
curl "http://localhost:3000/api/calendar/events?date=$(date +%Y-%m-%d)&tz=Asia/Taipei" \
  -H "Cookie: <your-session-cookie>"
```
Expected: JSON 含 `"connected":true` 和 `"events":[...]`。若今日無事件則 `events: []`。

故意改 `date` 為明天：
```bash
curl "http://localhost:3000/api/calendar/events?date=2099-01-01&tz=Asia/Taipei" \
  -H "Cookie: <your-session-cookie>"
```
Expected: `{"connected":true,"events":[]}`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/calendar/events/route.ts
git commit -m "feat(calendar): /api/calendar/events route"
```

---

## Task 10: `/api/calendar/calendars` route (GET + POST)

**Files:**
- Create: `src/app/api/calendar/calendars/route.ts`

- [ ] **Step 1: 實作**

Create `src/app/api/calendar/calendars/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAccessToken } from "@/lib/google-calendar/tokens";
import { listCalendars } from "@/lib/google-calendar/api";
import type { CalendarsResponse } from "@/lib/google-calendar/types";

export async function GET(): Promise<NextResponse<CalendarsResponse | { error: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getAccessToken(session.user.id);
  if (token.status !== "ok") {
    return NextResponse.json({ error: token.status }, { status: 400 });
  }

  try {
    const calendars = await listCalendars(token.accessToken);
    return NextResponse.json({
      calendars,
      selectedIds: token.selectedIds,
    });
  } catch (e) {
    console.error("listCalendars failed:", e);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!Array.isArray(body.selectedIds)) {
    return NextResponse.json({ error: "selectedIds must be an array" }, { status: 400 });
  }
  const ids: string[] = body.selectedIds.filter((x: unknown) => typeof x === "string");

  await db
    .update(users)
    .set({ googleCalendarSelectedIds: JSON.stringify(ids) })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ selectedIds: ids });
}
```

- [ ] **Step 2: 手動驗證**

```bash
curl "http://localhost:3000/api/calendar/calendars" -H "Cookie: <session>"
```
Expected: `{"calendars":[{id,summary,...}],"selectedIds":["primary"]}`

```bash
curl -X POST "http://localhost:3000/api/calendar/calendars" \
  -H "Cookie: <session>" -H "Content-Type: application/json" \
  -d '{"selectedIds":["primary","<your-other-calendar-id>"]}'
```
Expected: `{"selectedIds":["primary","..."]}`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/calendar/calendars/route.ts
git commit -m "feat(calendar): /api/calendar/calendars GET+POST"
```

---

## Task 11: i18n — 新增 calendar 命名空間（web + mobile）

**Files:**
- Modify: `i18n/canonical/zh-TW.json`, `en.json`, `ja.json`
- Modify: `mobile/lib/l10n/app_zh.arb`, `app_en.arb`, `app_ja.arb`

- [ ] **Step 1: 加 zh-TW 的 calendar 區塊**

在 `i18n/canonical/zh-TW.json` 的 JSON 物件裡（和其他命名空間同層），加：

```json
"calendar": {
  "section": "行事曆",
  "connectTitle": "連結 Google Calendar",
  "connectDescription": "看看今天有哪些會議",
  "connectButton": "連結",
  "disconnectButton": "中斷連結",
  "disconnectConfirmTitle": "中斷連結",
  "disconnectConfirmBody": "確定要中斷 Google Calendar 連結嗎？",
  "connectedAs": "已連結：{email}",
  "subCalendars": "顯示哪些日曆",
  "panelTitle": "今日行程",
  "panelEmpty": "今天沒有行程",
  "panelLoading": "載入中…",
  "panelError": "無法載入行事曆",
  "panelRetry": "重試",
  "panelReauth": "授權過期，請重新連結",
  "panelRefresh": "重新整理",
  "eventAllDay": "整日",
  "eventBusy": "忙碌",
  "eventLocation": "地點",
  "eventAttendees": "與會者",
  "eventDescription": "描述",
  "eventOpenInGoogle": "在 Google Calendar 開啟",
  "mobileCollapsedCount": "今日行程 · {count} 件",
  "mobileCollapsedEmpty": "今日無行程",
  "mobileConnectPrompt": "連結 Google Calendar →"
}
```

- [ ] **Step 2: 加 en 的對應**

在 `i18n/canonical/en.json` 加：

```json
"calendar": {
  "section": "Calendar",
  "connectTitle": "Connect Google Calendar",
  "connectDescription": "See your meetings for today",
  "connectButton": "Connect",
  "disconnectButton": "Disconnect",
  "disconnectConfirmTitle": "Disconnect",
  "disconnectConfirmBody": "Disconnect from Google Calendar?",
  "connectedAs": "Connected as {email}",
  "subCalendars": "Calendars to show",
  "panelTitle": "Today",
  "panelEmpty": "Nothing scheduled today",
  "panelLoading": "Loading…",
  "panelError": "Couldn't load calendar",
  "panelRetry": "Retry",
  "panelReauth": "Authorization expired, reconnect",
  "panelRefresh": "Refresh",
  "eventAllDay": "All day",
  "eventBusy": "Busy",
  "eventLocation": "Location",
  "eventAttendees": "Attendees",
  "eventDescription": "Description",
  "eventOpenInGoogle": "Open in Google Calendar",
  "mobileCollapsedCount": "Today · {count} events",
  "mobileCollapsedEmpty": "Nothing today",
  "mobileConnectPrompt": "Connect Google Calendar →"
}
```

- [ ] **Step 3: 加 ja 的對應**

在 `i18n/canonical/ja.json` 加：

```json
"calendar": {
  "section": "カレンダー",
  "connectTitle": "Google カレンダーを連携",
  "connectDescription": "今日の予定を確認できます",
  "connectButton": "連携する",
  "disconnectButton": "連携解除",
  "disconnectConfirmTitle": "連携解除",
  "disconnectConfirmBody": "Google カレンダーとの連携を解除しますか？",
  "connectedAs": "連携中：{email}",
  "subCalendars": "表示するカレンダー",
  "panelTitle": "今日の予定",
  "panelEmpty": "今日は予定がありません",
  "panelLoading": "読み込み中…",
  "panelError": "カレンダーを読み込めませんでした",
  "panelRetry": "再試行",
  "panelReauth": "認証が切れました。再連携してください",
  "panelRefresh": "更新",
  "eventAllDay": "終日",
  "eventBusy": "ビジー",
  "eventLocation": "場所",
  "eventAttendees": "参加者",
  "eventDescription": "詳細",
  "eventOpenInGoogle": "Google カレンダーで開く",
  "mobileCollapsedCount": "今日の予定 · {count} 件",
  "mobileCollapsedEmpty": "今日は予定なし",
  "mobileConnectPrompt": "Google カレンダーを連携 →"
}
```

- [ ] **Step 4: 跑 i18n sync 產出 src/messages 和 mobile arb**

Run: `npm run i18n:sync`
Expected: `src/messages/{en,ja,zh-TW}.json`、`mobile/lib/l10n/app_*.arb` 都有 `calendar` 區塊（或對應 key）。

- [ ] **Step 5: 產生 Flutter l10n dart**

Run: `cd mobile && flutter gen-l10n && cd ..`
Expected: `mobile/lib/l10n/app_localizations*.dart` 更新，有 `calendarPanelTitle` 等 getter（名稱依 gen-l10n 規則）。

- [ ] **Step 6: Typecheck web**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 沒有 i18n type 錯誤

- [ ] **Step 7: Commit**

```bash
git add i18n/canonical src/messages mobile/lib/l10n
git commit -m "feat(i18n): calendar namespace (zh-TW/en/ja)"
```

---

## Task 12: Web — SWR hook `use-calendar-events`

**Files:**
- Create: `src/hooks/use-calendar-events.ts`

- [ ] **Step 1: 實作**

Create `src/hooks/use-calendar-events.ts`:

```ts
"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { EventsResponse } from "@/lib/google-calendar/types";

function getUserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function useCalendarEvents(date: string) {
  const tz = getUserTz();
  const key = `/api/calendar/events?date=${date}&tz=${encodeURIComponent(tz)}`;
  const { data, error, isLoading, mutate } = useSWR<EventsResponse>(key, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });

  return { data, error, isLoading, refresh: () => mutate() };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-calendar-events.ts
git commit -m "feat(calendar): SWR hook for events"
```

---

## Task 13: Web — `CalendarEventItem` 元件（含 inline expand）

**Files:**
- Create: `src/components/calendar/calendar-event-item.tsx`

- [ ] **Step 1: 實作**

Create `src/components/calendar/calendar-event-item.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import type { CalendarEvent } from "@/lib/google-calendar/types";

interface Props {
  event: CalendarEvent;
  expanded: boolean;
  onToggle: () => void;
  past: boolean;
}

function formatTimeRange(start: string, end: string, allDay: boolean, allDayLabel: string): string {
  if (allDay) return allDayLabel;
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export function CalendarEventItem({ event, expanded, onToggle, past }: Props) {
  const t = useTranslations("calendar");
  const timeLabel = formatTimeRange(event.start, event.end, event.allDay, t("eventAllDay"));
  const canExpand = !event.busyOnly;

  return (
    <div
      className={`rounded-md border border-border bg-card text-sm ${
        past ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        onClick={canExpand ? onToggle : undefined}
        className={`w-full px-3 py-2 text-left flex items-center gap-2 ${
          canExpand ? "cursor-pointer hover:bg-surface-hover" : "cursor-default"
        }`}
        aria-expanded={canExpand ? expanded : undefined}
      >
        <div className="flex-1 min-w-0">
          <div className="text-xs text-text-dim">{timeLabel}</div>
          <div className="truncate text-foreground">{event.title}</div>
        </div>
        {canExpand && (
          <span className="text-text-dim">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </button>

      {canExpand && expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2 text-xs">
          {event.location && (
            <div>
              <div className="uppercase tracking-wide text-text-faint text-[10px]">
                {t("eventLocation")}
              </div>
              <div className="text-foreground">{event.location}</div>
            </div>
          )}
          {event.attendees.length > 0 && (
            <div>
              <div className="uppercase tracking-wide text-text-faint text-[10px]">
                {t("eventAttendees")}
              </div>
              <div className="text-foreground">{event.attendees.join(" · ")}</div>
            </div>
          )}
          {event.description && (
            <div>
              <div className="uppercase tracking-wide text-text-faint text-[10px]">
                {t("eventDescription")}
              </div>
              <div className="text-text-dim whitespace-pre-wrap line-clamp-6">
                {event.description}
              </div>
            </div>
          )}
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink size={12} />
              {t("eventOpenInGoogle")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/calendar-event-item.tsx
git commit -m "feat(calendar): CalendarEventItem with inline expand"
```

---

## Task 14: Web — `CalendarEmptyState` 元件

**Files:**
- Create: `src/components/calendar/calendar-empty-state.tsx`

- [ ] **Step 1: 實作**

Create `src/components/calendar/calendar-empty-state.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { CalendarPlus } from "lucide-react";

type Variant = "not_connected" | "empty" | "error" | "reauth";

interface Props {
  variant: Variant;
  onRetry?: () => void;
}

export function CalendarEmptyState({ variant, onRetry }: Props) {
  const t = useTranslations("calendar");

  if (variant === "not_connected") {
    return (
      <div className="flex flex-col items-start gap-2 p-3 text-sm">
        <div className="text-text-dim">{t("connectDescription")}</div>
        <a
          href="/api/calendar/connect"
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
        >
          <CalendarPlus size={14} />
          {t("connectTitle")}
        </a>
      </div>
    );
  }

  if (variant === "empty") {
    return (
      <div className="p-4 text-center text-sm text-text-dim">
        {t("panelEmpty")}
      </div>
    );
  }

  if (variant === "reauth") {
    return (
      <div className="flex flex-col items-start gap-2 p-3 text-sm">
        <div className="text-text-dim">{t("panelReauth")}</div>
        <a
          href="/api/calendar/connect"
          className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
        >
          {t("connectButton")}
        </a>
      </div>
    );
  }

  // error
  return (
    <div className="flex flex-col items-start gap-2 p-3 text-sm">
      <div className="text-text-dim">{t("panelError")}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-surface-hover"
        >
          {t("panelRetry")}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/calendar-empty-state.tsx
git commit -m "feat(calendar): CalendarEmptyState variants"
```

---

## Task 15: Web — `CalendarPanel` 主容器

**Files:**
- Create: `src/components/calendar/calendar-panel.tsx`

- [ ] **Step 1: 實作**

Create `src/components/calendar/calendar-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { CalendarEventItem } from "./calendar-event-item";
import { CalendarEmptyState } from "./calendar-empty-state";

interface Props {
  date: string; // YYYY-MM-DD
}

export function CalendarPanel({ date }: Props) {
  const t = useTranslations("calendar");
  const { data, error, isLoading, refresh } = useCalendarEvents(date);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const now = Date.now();

  return (
    <aside
      aria-label={t("panelTitle")}
      className="hidden md:flex fixed left-14 top-0 bottom-0 z-30 w-[260px] flex-col border-r border-border bg-background"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <div className="text-sm font-semibold text-foreground">{t("panelTitle")}</div>
          <div className="text-xs text-text-dim">Google Calendar</div>
        </div>
        <button
          type="button"
          onClick={refresh}
          aria-label={t("panelRefresh")}
          title={t("panelRefresh")}
          className="rounded-md p-1 text-text-dim hover:bg-surface-hover hover:text-foreground"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
        {/* Not connected */}
        {data && data.connected === false && data.reason !== "reauth_required" && (
          <CalendarEmptyState variant="not_connected" />
        )}
        {data && data.connected === false && data.reason === "reauth_required" && (
          <CalendarEmptyState variant="reauth" />
        )}

        {/* Error */}
        {error && !data && <CalendarEmptyState variant="error" onRetry={refresh} />}

        {/* Loading skeleton */}
        {isLoading && !data && (
          <>
            <div className="h-12 rounded-md bg-muted animate-pulse" />
            <div className="h-12 rounded-md bg-muted animate-pulse" />
            <div className="h-12 rounded-md bg-muted animate-pulse" />
          </>
        )}

        {/* Connected with events */}
        {data && data.connected && data.events.length === 0 && (
          <CalendarEmptyState variant="empty" />
        )}

        {data && data.connected && data.events.length > 0 && (
          <div className="space-y-2">
            {data.events.map((e) => {
              const past = new Date(e.end).getTime() < now && !e.allDay;
              return (
                <CalendarEventItem
                  key={`${e.calendarId}-${e.id}`}
                  event={e}
                  past={past}
                  expanded={expandedId === `${e.calendarId}-${e.id}`}
                  onToggle={() =>
                    setExpandedId((cur) =>
                      cur === `${e.calendarId}-${e.id}` ? null : `${e.calendarId}-${e.id}`
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/calendar-panel.tsx
git commit -m "feat(calendar): CalendarPanel container"
```

---

## Task 16: Web — 把 `CalendarPanel` 放進 Tasks 頁，並讓內容向右偏移

**Files:**
- Modify: `src/app/[locale]/(app)/day/[date]/page.tsx`

**Note:** 現有的 main content area 有 `md:ml-14` 之類讓出 sidebar 的 margin（56px）。加上 260px 的 panel 後，Tasks 頁需要變成 `md:ml-[316px]`（14+260-4px for border 之類，實際依 layout 決定）。panel 只在 md+ 顯示，小螢幕完全隱藏（mobile 由 Flutter 處理，web mobile viewport 可暫時不顯示 panel）。

- [ ] **Step 1: 讀當前檔案**

Run: `cat "src/app/[locale]/(app)/day/[date]/page.tsx"`

記住現有 JSX 結構，以及目前 content 的最外層 div 的 className。

- [ ] **Step 2: 引入 CalendarPanel 並調整 margin**

在 `page.tsx` 頂部加 import：

```tsx
import { CalendarPanel } from "@/components/calendar/calendar-panel";
```

在 JSX 最外層 fragment 裡加上 `<CalendarPanel date={date} />`（`date` 是頁面的 prop；若 route param 是 promise 需要 `await params`）。

然後把原本的內容最外層 wrapper（例如 `<main className="md:ml-14 ...">`）改成：

```tsx
<main className="md:ml-14 md:pl-[260px] ..."> {/* 保留原本其他 class */}
  {/* 既有內容 */}
</main>
```

`md:pl-[260px]` 讓 content 空出 260px 給 panel（panel 用 `fixed left-14` 定位，不佔 flow）。

- [ ] **Step 3: 手動測試**

啟 dev server（若未啟）：`npm run dev`

1. 登入 → 進 `/` → 應該被 redirect 到 `/day/YYYY-MM-DD`
2. 視窗 > 768px 時：左側 56px icon rail + 接著 260px 日曆 panel + 右側任務內容
3. 未連結狀態應顯示「連結 Google Calendar」按鈕
4. 已連結狀態應看到今日事件或「今天沒有行程」
5. 切到 `/cards`、`/notes` 頁 panel 應該消失（因為只在 Tasks page 引入）
6. 視窗 < 768px 時 panel 應完全隱藏

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/(app)/day/[date]/page.tsx"
git commit -m "feat(calendar): mount CalendarPanel on Tasks page"
```

---

## Task 17: Web — 設定頁 `CalendarSection`

**Files:**
- Create: `src/components/settings/calendar-section.tsx`
- Modify: `src/components/settings/settings-modal.tsx`

- [ ] **Step 1: 實作 CalendarSection**

Create `src/components/settings/calendar-section.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { fetcher } from "@/lib/fetcher";
import type { CalendarsResponse } from "@/lib/google-calendar/types";

export function CalendarSection({ userEmail }: { userEmail: string }) {
  const t = useTranslations("calendar");
  const { data, error, isLoading, mutate } = useSWR<
    CalendarsResponse | { error: string }
  >("/api/calendar/calendars", fetcher, { shouldRetryOnError: false });

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const isConnected =
    data && "calendars" in data && Array.isArray(data.calendars);

  async function toggleCalendar(id: string, selected: boolean) {
    if (!isConnected) return;
    const current = new Set(data.selectedIds);
    if (selected) current.add(id);
    else current.delete(id);
    const next = Array.from(current);
    await fetch("/api/calendar/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedIds: next }),
    });
    mutate({ ...data, selectedIds: next }, { revalidate: false });
  }

  async function disconnect() {
    await fetch("/api/calendar/disconnect", { method: "POST" });
    setConfirmDisconnect(false);
    mutate();
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{t("section")}</h3>

      {isLoading && <div className="text-xs text-text-dim">{t("panelLoading")}</div>}

      {!isLoading && !isConnected && (
        <div>
          <div className="text-xs text-text-dim mb-2">{t("connectDescription")}</div>
          <a
            href="/api/calendar/connect"
            className="inline-block rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            {t("connectButton")}
          </a>
        </div>
      )}

      {isConnected && (
        <>
          <div className="text-xs text-text-dim">
            {t("connectedAs", { email: userEmail })}
          </div>

          <div>
            <div className="text-xs text-text-faint uppercase tracking-wide mb-1">
              {t("subCalendars")}
            </div>
            <div className="space-y-1">
              {data.calendars.map((cal) => {
                const checked = data.selectedIds.includes(cal.id);
                return (
                  <label
                    key={cal.id}
                    className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleCalendar(cal.id, e.target.checked)}
                    />
                    {cal.backgroundColor && (
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ background: cal.backgroundColor }}
                      />
                    )}
                    <span>{cal.summary}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {!confirmDisconnect ? (
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              className="text-sm text-destructive hover:underline"
            >
              {t("disconnectButton")}
            </button>
          ) : (
            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="text-sm text-foreground">{t("disconnectConfirmBody")}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={disconnect}
                  className="rounded-md bg-destructive px-3 py-1 text-sm text-primary-foreground"
                >
                  {t("disconnectButton")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDisconnect(false)}
                  className="rounded-md border border-border px-3 py-1 text-sm"
                >
                  {/* common.cancel */}
                  ×
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 引入到 SettingsModal**

讀 `src/components/settings/settings-modal.tsx`，找到其他 section（例如 `<ThemeSection>` 或 `<AppearanceSection>`）的位置。在其中一個合適位置（建議：語言區塊之後、標籤管理之前）插入：

```tsx
import { CalendarSection } from "./calendar-section";

// ...在 JSX 裡：
<CalendarSection userEmail={session?.user?.email ?? ""} />
```

如果 settings-modal 不能直接拿到 session email，可以從 `useSession()`（`next-auth/react`）或既有的 user context 取得；若有既有寫法（例如 `AccountSection`）直接複製該模式。

- [ ] **Step 3: 手動測試整條流程**

Run: `npm run dev`

1. 開設定 → 看到「行事曆」區塊
2. 未連結 → 點「連結」→ Google 授權 → 回來 → 設定頁應顯示「已連結：your@email.com」+ 子日曆清單
3. 勾掉一個子日曆 → 回到 Tasks 頁 → 手動按 panel 的 refresh 按鈕 → 該日曆的事件應該消失
4. 再勾回來 → refresh → 事件回來
5. 點「中斷連結」→ 確認 → 應該回到「連結」按鈕狀態

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/calendar-section.tsx src/components/settings/settings-modal.tsx
git commit -m "feat(calendar): settings CalendarSection"
```

---

## Task 18: Mobile — calendar models

**Files:**
- Create: `mobile/lib/features/calendar/calendar_models.dart`

- [ ] **Step 1: 實作**

Create `mobile/lib/features/calendar/calendar_models.dart`:

```dart
class CalendarEvent {
  final String id;
  final String calendarId;
  final String calendarName;
  final String title;
  final DateTime start;
  final DateTime end;
  final bool allDay;
  final String? location;
  final String? description;
  final List<String> attendees;
  final String htmlLink;
  final bool busyOnly;

  CalendarEvent({
    required this.id,
    required this.calendarId,
    required this.calendarName,
    required this.title,
    required this.start,
    required this.end,
    required this.allDay,
    required this.location,
    required this.description,
    required this.attendees,
    required this.htmlLink,
    required this.busyOnly,
  });

  factory CalendarEvent.fromJson(Map<String, dynamic> json) {
    return CalendarEvent(
      id: json['id'] as String,
      calendarId: json['calendarId'] as String,
      calendarName: json['calendarName'] as String? ?? '',
      title: json['title'] as String? ?? '',
      start: DateTime.parse(json['start'] as String),
      end: DateTime.parse(json['end'] as String),
      allDay: json['allDay'] as bool? ?? false,
      location: json['location'] as String?,
      description: json['description'] as String?,
      attendees: ((json['attendees'] as List?) ?? [])
          .map((e) => e.toString())
          .toList(),
      htmlLink: json['htmlLink'] as String? ?? '',
      busyOnly: json['busyOnly'] as bool? ?? false,
    );
  }
}

/// /api/calendar/events response
class CalendarEventsResponse {
  final bool connected;
  final String? reason;
  final List<CalendarEvent> events;

  CalendarEventsResponse({
    required this.connected,
    this.reason,
    required this.events,
  });

  factory CalendarEventsResponse.fromJson(Map<String, dynamic> json) {
    final connected = json['connected'] as bool? ?? false;
    return CalendarEventsResponse(
      connected: connected,
      reason: json['reason'] as String?,
      events: connected
          ? ((json['events'] as List?) ?? [])
              .map((e) => CalendarEvent.fromJson(e as Map<String, dynamic>))
              .toList()
          : <CalendarEvent>[],
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/features/calendar/calendar_models.dart
git commit -m "feat(mobile,calendar): event models"
```

---

## Task 19: Mobile — calendar repository + provider

**Files:**
- Create: `mobile/lib/features/calendar/calendar_repository.dart`
- Create: `mobile/lib/features/calendar/calendar_provider.dart`

- [ ] **Step 1: Repository**

Create `mobile/lib/features/calendar/calendar_repository.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import 'calendar_models.dart';

class CalendarRepository {
  final ApiClient _api;
  CalendarRepository(this._api);

  Future<CalendarEventsResponse> fetchEvents(String date) async {
    final tz = DateTime.now().timeZoneName; // 粗略 fallback，iOS/Android 通常給 IANA 名或縮寫
    final response = await _api.dio.get(
      '/api/calendar/events',
      queryParameters: {'date': date, 'tz': tz},
    );
    return CalendarEventsResponse.fromJson(
      response.data as Map<String, dynamic>,
    );
  }
}

final calendarRepositoryProvider = Provider<CalendarRepository>((ref) {
  return CalendarRepository(ref.read(apiClientProvider));
});
```

- [ ] **Step 2: Provider + controller**

Create `mobile/lib/features/calendar/calendar_provider.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'calendar_models.dart';
import 'calendar_repository.dart';

final calendarEventsProvider =
    FutureProvider.family<CalendarEventsResponse, String>((ref, date) async {
  final repo = ref.read(calendarRepositoryProvider);
  return repo.fetchEvents(date);
});

/// 收合/展開狀態，跨 app 啟動保持
final calendarCollapsedProvider =
    NotifierProvider<CalendarCollapsedNotifier, bool>(
  CalendarCollapsedNotifier.new,
);

class CalendarCollapsedNotifier extends Notifier<bool> {
  static const _key = 'calendar_strip_collapsed';

  @override
  bool build() {
    _load();
    return true; // 預設收合
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getBool(_key);
    if (stored != null) state = stored;
  }

  Future<void> toggle() async {
    state = !state;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key, state);
  }
}
```

**Note:** `shared_preferences` 應已在 `pubspec.yaml`；若無，先加。

- [ ] **Step 3: 檢查 pubspec**

Run: `cd mobile && grep shared_preferences pubspec.yaml && cd ..`
Expected: 有列出；若無，執行 `cd mobile && flutter pub add shared_preferences && cd ..`

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/features/calendar/ mobile/pubspec.yaml mobile/pubspec.lock
git commit -m "feat(mobile,calendar): repository + riverpod providers"
```

---

## Task 20: Mobile — `CalendarEventTile`（含 inline expand）

**Files:**
- Create: `mobile/lib/features/calendar/calendar_event_tile.dart`

- [ ] **Step 1: 實作**

Create `mobile/lib/features/calendar/calendar_event_tile.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';
import 'calendar_models.dart';

class CalendarEventTile extends StatelessWidget {
  final CalendarEvent event;
  final bool expanded;
  final VoidCallback onTap;
  final bool past;

  const CalendarEventTile({
    super.key,
    required this.event,
    required this.expanded,
    required this.onTap,
    required this.past,
  });

  String _formatTime(BuildContext context) {
    final l10n = AppL10n.of(context)!;
    if (event.allDay) return l10n.calendarEventAllDay;
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(event.start.hour)}:${two(event.start.minute)} – '
        '${two(event.end.hour)}:${two(event.end.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppL10n.of(context)!;
    final canExpand = !event.busyOnly;
    final opacity = past ? 0.55 : 1.0;

    return Opacity(
      opacity: opacity,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              onTap: canExpand ? onTap : null,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _formatTime(context),
                            style: TextStyle(fontSize: 11, color: AppColors.textDim),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            event.title,
                            style: TextStyle(fontSize: 13, color: AppColors.foreground),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    if (canExpand)
                      Icon(
                        expanded ? Icons.expand_less : Icons.expand_more,
                        size: 16,
                        color: AppColors.textDim,
                      ),
                  ],
                ),
              ),
            ),
            if (canExpand && expanded)
              Container(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: AppColors.border)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (event.location != null)
                      _DetailRow(label: l10n.calendarEventLocation, value: event.location!),
                    if (event.attendees.isNotEmpty)
                      _DetailRow(
                        label: l10n.calendarEventAttendees,
                        value: event.attendees.join(' · '),
                      ),
                    if (event.description != null)
                      _DetailRow(
                        label: l10n.calendarEventDescription,
                        value: event.description!,
                        maxLines: 6,
                      ),
                    if (event.htmlLink.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: InkWell(
                          onTap: () => launchUrl(Uri.parse(event.htmlLink)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.open_in_new, size: 12, color: AppColors.primary),
                              const SizedBox(width: 4),
                              Text(
                                l10n.calendarEventOpenInGoogle,
                                style: TextStyle(fontSize: 11, color: AppColors.primary),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final int maxLines;

  const _DetailRow({required this.label, required this.value, this.maxLines = 2});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 9,
              color: AppColors.textFaint,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 1),
          Text(
            value,
            style: TextStyle(fontSize: 11, color: AppColors.foreground),
            maxLines: maxLines,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
```

**Note:** 這用到 `AppL10n.of(context)!.calendarEventAllDay` 之類的 getter。實際 getter 名稱由 `flutter gen-l10n` 依 arb key 產生（通常 snake→camelCase）。Task 11 已產出 `app_localizations*.dart`；如果 getter 名稱不同，以產出為準調整。

**Note:** `url_launcher` 應已在 `pubspec.yaml`；若無，`cd mobile && flutter pub add url_launcher`。

- [ ] **Step 2: 檢查 url_launcher**

Run: `grep url_launcher mobile/pubspec.yaml`
Expected: 有列出；若無，`cd mobile && flutter pub add url_launcher && cd ..`

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/features/calendar/calendar_event_tile.dart mobile/pubspec.yaml mobile/pubspec.lock
git commit -m "feat(mobile,calendar): CalendarEventTile"
```

---

## Task 21: Mobile — `CalendarStrip`（收合 / 展開容器）

**Files:**
- Create: `mobile/lib/features/calendar/calendar_strip.dart`

- [ ] **Step 1: 實作**

Create `mobile/lib/features/calendar/calendar_strip.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';
import 'calendar_event_tile.dart';
import 'calendar_models.dart';
import 'calendar_provider.dart';

class CalendarStrip extends ConsumerStatefulWidget {
  final String date;
  const CalendarStrip({super.key, required this.date});

  @override
  ConsumerState<CalendarStrip> createState() => _CalendarStripState();
}

class _CalendarStripState extends ConsumerState<CalendarStrip> {
  String? _expandedEventKey;

  @override
  Widget build(BuildContext context) {
    final l10n = AppL10n.of(context)!;
    final collapsed = ref.watch(calendarCollapsedProvider);
    final eventsAsync = ref.watch(calendarEventsProvider(widget.date));

    return eventsAsync.when(
      data: (resp) => _buildStrip(context, l10n, collapsed, resp),
      loading: () => _buildHeader(
        context,
        l10n,
        collapsed,
        label: l10n.calendarPanelLoading,
      ),
      error: (_, __) => _buildHeader(
        context,
        l10n,
        collapsed,
        label: l10n.calendarPanelError,
      ),
    );
  }

  Widget _buildStrip(
    BuildContext context,
    AppL10n l10n,
    bool collapsed,
    CalendarEventsResponse resp,
  ) {
    if (!resp.connected) {
      return _buildHeader(
        context,
        l10n,
        collapsed,
        label: l10n.calendarMobileConnectPrompt,
        isCta: true,
      );
    }

    final count = resp.events.length;
    final headerLabel = count == 0
        ? l10n.calendarMobileCollapsedEmpty
        : l10n.calendarMobileCollapsedCount(count);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildHeader(context, l10n, collapsed, label: headerLabel),
        if (!collapsed && count > 0)
          Container(
            margin: const EdgeInsets.fromLTRB(14, 0, 14, 4),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.card,
              border: Border.all(color: AppColors.border),
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(8),
                bottomRight: Radius.circular(8),
              ),
            ),
            child: Column(
              children: [
                for (final e in resp.events)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: CalendarEventTile(
                      event: e,
                      expanded: _expandedEventKey == '${e.calendarId}-${e.id}',
                      past: e.end.isBefore(DateTime.now()) && !e.allDay,
                      onTap: () {
                        setState(() {
                          final key = '${e.calendarId}-${e.id}';
                          _expandedEventKey =
                              _expandedEventKey == key ? null : key;
                        });
                      },
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildHeader(
    BuildContext context,
    AppL10n l10n,
    bool collapsed, {
    required String label,
    bool isCta = false,
  }) {
    return GestureDetector(
      onTap: () {
        if (isCta) {
          // 連結按鈕：導到設定頁的日曆區塊
          // Settings screen 會處理連結按鈕行為（Task 23）
          return;
        }
        ref.read(calendarCollapsedProvider.notifier).toggle();
      },
      child: Container(
        margin: const EdgeInsets.fromLTRB(14, 4, 14, collapsed ? 4 : 0),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.muted,
          border: Border.all(color: AppColors.border),
          borderRadius: collapsed
              ? BorderRadius.circular(8)
              : const BorderRadius.only(
                  topLeft: Radius.circular(8),
                  topRight: Radius.circular(8),
                ),
        ),
        child: Row(
          children: [
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(fontSize: 12, color: AppColors.foreground),
              ),
            ),
            if (!isCta)
              Icon(
                collapsed ? Icons.expand_more : Icons.expand_less,
                size: 16,
                color: AppColors.textDim,
              ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/features/calendar/calendar_strip.dart
git commit -m "feat(mobile,calendar): CalendarStrip collapsed/expanded"
```

---

## Task 22: Mobile — 把 `CalendarStrip` 放進 Tasks 頁

**Files:**
- Modify: `mobile/lib/features/tasks/tasks_screen.dart`

- [ ] **Step 1: 讀現況**

Run: `cat mobile/lib/features/tasks/tasks_screen.dart | head -80`

找到週曆 bar 的 widget 和任務列表之間的位置。

- [ ] **Step 2: 加 import 和 widget**

在檔案頂部加：

```dart
import '../calendar/calendar_strip.dart';
import '../calendar/calendar_provider.dart';
```

在週曆 bar 下方、任務列表上方插入（假設 `selectedDate` 是當前變數；實際名稱以檔案內為準）：

```dart
CalendarStrip(date: selectedDate),
```

- [ ] **Step 3: 跑模擬器驗證**

Run: `cd mobile && flutter run -d <simulator-id>`

1. Tasks 頁應該在週曆 bar 下看到一條橫幅
2. 未連結時顯示「連結 Google Calendar →」
3. 已連結時顯示「今日行程 · N 件 ⌄」或「今日無行程」
4. 點展開/收合有作用
5. 事件點擊 → inline 展開細節
6. 殺掉 app 重開 → 收合/展開狀態保持

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/features/tasks/tasks_screen.dart
git commit -m "feat(mobile,calendar): mount CalendarStrip on Tasks screen"
```

---

## Task 23: Mobile — 設定頁日曆區塊

Mobile 不做原生 OAuth，只顯示連結狀態 + 「到 web 連結」按鈕 + disconnect 按鈕。

**Files:**
- Modify: `mobile/lib/features/settings/settings_screen.dart`

- [ ] **Step 1: 讀現況並找插入點**

Run: `cat mobile/lib/features/settings/settings_screen.dart`

找到適合插入日曆區塊的位置（建議：語言區塊之後、標籤管理之前）。

- [ ] **Step 2: 新增 section**

先引入：

```dart
import '../calendar/calendar_provider.dart';
import 'package:url_launcher/url_launcher.dart';
// 如果專案有 webHost 常數就用；否則用既有的 ApiClient baseUrl
```

在 settings 的 Column/ListView 裡插入：

```dart
Consumer(
  builder: (context, ref, _) {
    final l10n = AppL10n.of(context)!;
    final eventsAsync = ref.watch(
      calendarEventsProvider(DateTime.now().toIso8601String().substring(0, 10)),
    );
    final connected = eventsAsync.maybeWhen(
      data: (r) => r.connected,
      orElse: () => false,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.calendarSection,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.foreground,
            ),
          ),
          const SizedBox(height: 8),
          if (!connected)
            OutlinedButton(
              onPressed: () {
                // 用 api client 的 baseUrl 組出 settings 頁連結
                final base = ref.read(apiClientProvider).dio.options.baseUrl;
                launchUrl(
                  Uri.parse('$base/settings'),
                  mode: LaunchMode.externalApplication,
                );
              },
              child: Text(l10n.calendarConnectButton),
            )
          else
            Text(
              l10n.calendarPanelTitle, // "今日行程" — 簡單告知已連結
              style: TextStyle(fontSize: 12, color: AppColors.textDim),
            ),
        ],
      ),
    );
  },
),
```

- [ ] **Step 3: 跑模擬器驗證**

Run: 確認 `flutter run` 仍在跑，hot reload（`r`）

1. Settings 頁看到「行事曆」區塊
2. 未連結時按「連結」→ 系統瀏覽器開 web 的 /settings
3. 在 web 完成連結後回到 App
4. 下拉重新整理 Tasks 頁 → `CalendarStrip` 應該轉為已連結狀態

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/features/settings/settings_screen.dart
git commit -m "feat(mobile,calendar): settings section with web connect link"
```

---

## Task 24: 手動 QA checklist

無程式碼改動，只是一次完整走過整個流程確認沒漏。

- [ ] **Step 1: Web — 未連結 → 連結**

1. 清掉本機 DB 的 token 欄位：
   ```bash
   psql $DATABASE_URL -c "UPDATE users SET google_calendar_access_token=NULL, google_calendar_refresh_token=NULL, google_calendar_token_expires=NULL, google_calendar_selected_ids=NULL"
   ```
2. 開 Tasks 頁 → panel 應顯示「連結 Google Calendar」按鈕
3. 點按鈕 → Google 授權 → 跳回 → 看到 events 載入

- [ ] **Step 2: Web — 事件展開 / 收起**

1. 點任一事件 → 細節展開在下方
2. 點另一個事件 → 前一個自動收起
3. 再點同一個 → 收起
4. 點「在 Google Calendar 開啟」→ 新分頁開啟 Google 頁面

- [ ] **Step 3: Web — 子日曆勾選**

1. 設定頁的日曆區塊勾掉 primary 之外的日曆
2. 回 Tasks 頁按 refresh → 事件列表應該只剩 primary 的
3. 勾回來 → refresh → 回來

- [ ] **Step 4: Web — 手動 token refresh**

1. `psql $DATABASE_URL -c "UPDATE users SET google_calendar_token_expires='2020-01-01T00:00:00Z' WHERE email = 'YOUR-EMAIL'"`
2. 重新整理 Tasks 頁 → 應該自動 refresh 成功（看 server log 有看到 refresh 呼叫）
3. 驗證 DB 的 `google_calendar_token_expires` 已被更新到未來時間

- [ ] **Step 5: Web — reauth 流程**

1. `psql $DATABASE_URL -c "UPDATE users SET google_calendar_refresh_token='corrupted-data' WHERE email = 'YOUR-EMAIL'"`
2. 重新整理 Tasks 頁 → 應該顯示「授權過期，請重新連結」
3. 按按鈕 → 重新走一次 OAuth → 回復正常

- [ ] **Step 6: Web — disconnect**

1. 設定頁按「中斷連結」→ 確認 → panel 回到「連結」狀態
2. DB 四個欄位都變 null

- [ ] **Step 7: Web — 切頁隱藏**

1. 從 Tasks 頁切到 Cards、Notes 頁 → panel 應該消失
2. 切回 Tasks 頁 → panel 回來

- [ ] **Step 8: Mobile — 完整流程（Flutter 模擬器）**

1. 殺掉 App 重開 → 收合狀態應為上次保存值
2. 未連結時橫幅是連結 CTA
3. 已連結時顯示「今日行程 · N 件」
4. 展開 / 收起運作
5. 點事件 → inline 展開
6. 點「在 Google Calendar 開啟」→ 系統瀏覽器開啟

- [ ] **Step 9: 記下已知限制 / 未解問題**

若任何一步失敗，先回到對應 Task 修復後重跑這張清單。全部通過才算完工。

- [ ] **Step 10: Commit（若只調整 checklist）**

（通常這個 task 無需 commit；如果 QA 發現 bug 就回到對應 task 修完再 commit）

---

## Final Checks

跑過所有自動化測試和 lint：

- [ ] `npm test` — web unit tests 全通過
- [ ] `npm run lint` — 無 error
- [ ] `npx tsc --noEmit -p tsconfig.json` — 無 error
- [ ] `cd mobile && flutter analyze && cd ..` — 無 error
- [ ] `npm run build` — Next.js 正常 build
- [ ] Git log 檢視：每個 task 應該有一個或兩個對應 commit，訊息格式清楚

---

## 已知小問題 / 後續優化（不列入本計畫）

- 事件顏色暫時全部用 `--primary`，未依子日曆 `backgroundColor` 區分（後續可加）
- 跨日事件只顯示在開始日，沒有 "continues" 標註
- Mobile 連結必須到 web 完成（使用者習慣後若需原生流程可再做）
- `getTzOffsetString` 在某些 runtime 可能拿不到 `longOffset`，建議上線後監測
- 單元測試只覆蓋 crypto 和 oauth 模組；API 路由依靠手動 QA

# Sign in with Apple — Web + Mac Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web（NextAuth Apple provider）與 Mac（伺服器中繼 + ASWebAuthenticationSession）補上 Sign in with Apple，三端共用同一個 sub 優先併號核心。

**Architecture:** 併號邏輯抽成純函式（deps 注入、可單測），三個入口共用：iOS 原生 POST route（行為不變）、NextAuth signIn callback、Mac 中繼 callback。Mac 流程 = `/start`（state+nonce cookie → redirect Apple）→ Apple form_post → `/callback`（驗證 → 併號 → 簽 app JWT → redirect `nudge://auth/apple#token=…`）。

**Tech Stack:** Next.js + NextAuth v5 + jose + drizzle；SwiftUI + ASWebAuthenticationSession。

**Spec:** `docs/superpowers/specs/2026-07-23-siwa-web-mac-design.md`

## Global Constraints

- iOS 原生 SIWA 流程與 `/api/auth/apple`（POST）對外行為**不得改變**。
- Swift 色只准 token（`Color.nudgeXxx`）；Apple 按鈕的黑/白是品牌例外，逐行 `// nudge:allow-color`。字級一律 `.nudgeFont(token)`。
- i18n：新 key `login.signInWithApple` 走 canonical → `npm run i18n:sync` → xcstrings 手動鏡像三語。
- Web feature flag：`AUTH_APPLE_ID`/`AUTH_APPLE_SECRET` 未設 → 不註冊 provider、不渲染按鈕、`/start` 回 404。Mac 端不做 flag。
- Mac Swift 併發鐵則（照 `GoogleSignInService+macOS.swift`）：service class **非 `@MainActor`**、callback 內只 `cont.resume`、碰 NSApp/NSWindow 一律 `DispatchQueue.main.async`。
- 端對端驗收在 prod（Apple return URL 限註冊過的 https 網域）。

---

### Task 1: 併號核心抽取 `resolveAppleUser` + 單元測試

**Files:**
- Create: `src/lib/auth/apple-account.ts`
- Test: `src/lib/auth/apple-account.test.ts`
- Modify: `src/app/api/auth/apple/route.ts`（改用共用核心；行為不變）

**Interfaces:**
- Produces: `resolveAppleUser(deps: AppleAccountDeps, identity: AppleIdentity): Promise<AppleUserRecord>`；`dbAppleAccountDeps: AppleAccountDeps`（drizzle 實作）。`AppleIdentity = { sub: string; email?: string | null; name?: string | null; locale?: string | null }`。Task 3（Mac callback）與 Task 4（NextAuth）都用這兩個匯出。

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/auth/apple-account.test.ts
import { describe, expect, it } from "vitest";
import {
  resolveAppleUser,
  type AppleAccountDeps,
  type AppleUserRecord,
} from "./apple-account";

function makeFakeDeps(seed: AppleUserRecord[] = []) {
  const usersById = new Map(seed.map((u) => [u.id, { ...u }]));
  const calls = { linked: [] as Array<{ userId: string; sub: string }>, provisioned: [] as Array<{ userId: string; locale: string | null }> };
  const deps: AppleAccountDeps = {
    async findByAppleSub(sub) {
      return [...usersById.values()].find((u) => u.appleSub === sub);
    },
    async findByEmail(email) {
      return [...usersById.values()].find((u) => u.email === email);
    },
    async linkAppleSub(userId, sub) {
      calls.linked.push({ userId, sub });
      const u = usersById.get(userId);
      if (u) u.appleSub = sub;
    },
    async createUser(u) {
      usersById.set(u.id, { ...u });
    },
    async provision(userId, locale) {
      calls.provisioned.push({ userId, locale });
    },
  };
  return { deps, usersById, calls };
}

const seedUser: AppleUserRecord = {
  id: "u1",
  email: "mike@example.com",
  name: "Mike",
  appleSub: null,
};

describe("resolveAppleUser", () => {
  it("① apple_sub 命中 → 直接回傳既有帳號", async () => {
    const { deps } = makeFakeDeps([{ ...seedUser, appleSub: "sub-1" }]);
    const user = await resolveAppleUser(deps, { sub: "sub-1" });
    expect(user.id).toBe("u1");
  });

  it("② sub 未命中但 email 命中 → 補 apple_sub 併號", async () => {
    const { deps, calls } = makeFakeDeps([seedUser]);
    const user = await resolveAppleUser(deps, { sub: "sub-2", email: "mike@example.com" });
    expect(user.id).toBe("u1");
    expect(calls.linked).toEqual([{ userId: "u1", sub: "sub-2" }]);
  });

  it("③ 都沒有 → 建新帳號並 provision（帶 locale）", async () => {
    const { deps, usersById, calls } = makeFakeDeps();
    const user = await resolveAppleUser(deps, {
      sub: "sub-3",
      email: "relay@privaterelay.appleid.com",
      name: "Hidden",
      locale: "en",
    });
    expect(usersById.has(user.id)).toBe(true);
    expect(user.email).toBe("relay@privaterelay.appleid.com");
    expect(user.appleSub).toBe("sub-3");
    expect(calls.provisioned).toEqual([{ userId: user.id, locale: "en" }]);
  });

  it("③ 無 email → 用 placeholder 滿足 NOT NULL/unique", async () => {
    const { deps } = makeFakeDeps();
    const user = await resolveAppleUser(deps, { sub: "sub-4" });
    expect(user.email).toBe("sub-4@appleid.nudge.local");
  });

  it("② 之後同 sub 再登入 → 走 ①、不再 link/provision", async () => {
    const { deps, calls } = makeFakeDeps([seedUser]);
    await resolveAppleUser(deps, { sub: "sub-5", email: "mike@example.com" });
    const again = await resolveAppleUser(deps, { sub: "sub-5" });
    expect(again.id).toBe("u1");
    expect(calls.linked.length).toBe(1);
    expect(calls.provisioned.length).toBe(0);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/auth/apple-account.test.ts`
Expected: FAIL（`Cannot find module './apple-account'`）

- [ ] **Step 3: 實作**

```ts
// src/lib/auth/apple-account.ts
/** Apple 帳號併號核心 — 三個入口共用：
 *  iOS 原生 POST /api/auth/apple、NextAuth signIn callback（web）、
 *  Mac 中繼 /api/auth/apple/callback。
 *  三段策略：① apple_sub 命中 → ② email 併號補 sub → ③ 建新帳號+provision。
 *  deps 注入讓核心是純編排、可單測（fake deps）。 */
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { provisionNewUser } from "@/lib/onboarding/provision-user";

export interface AppleUserRecord {
  id: string;
  email: string;
  name: string | null;
  appleSub: string | null;
}

export interface AppleAccountDeps {
  findByAppleSub(sub: string): Promise<AppleUserRecord | undefined>;
  findByEmail(email: string): Promise<AppleUserRecord | undefined>;
  linkAppleSub(userId: string, sub: string): Promise<void>;
  createUser(u: AppleUserRecord & { createdAt: string }): Promise<void>;
  provision(userId: string, locale: string | null): Promise<void>;
}

export interface AppleIdentity {
  sub: string;
  email?: string | null;
  name?: string | null;
  locale?: string | null;
}

export async function resolveAppleUser(
  deps: AppleAccountDeps,
  identity: AppleIdentity
): Promise<AppleUserRecord> {
  const { sub } = identity;
  const email = identity.email ?? undefined;

  // ① apple_sub 命中
  const bySub = await deps.findByAppleSub(sub);
  if (bySub) return bySub;

  // ② email 併號（補 apple_sub）
  if (email) {
    const byEmail = await deps.findByEmail(email);
    if (byEmail) {
      await deps.linkAppleSub(byEmail.id, sub);
      return { ...byEmail, appleSub: sub };
    }
  }

  // ③ 建新帳號（relay 信箱自成一帳號；真的沒 email 給穩定 placeholder）
  const newUser: AppleUserRecord & { createdAt: string } = {
    id: nanoid(),
    email: email ?? `${sub}@appleid.nudge.local`,
    name: identity.name?.trim() ? identity.name.trim() : null,
    appleSub: sub,
    createdAt: new Date().toISOString(),
  };
  await deps.createUser(newUser);
  await deps.provision(newUser.id, identity.locale ?? null);
  return newUser;
}

/** drizzle 實作 — production 路徑。 */
export const dbAppleAccountDeps: AppleAccountDeps = {
  async findByAppleSub(sub) {
    const [u] = await db.select().from(users).where(eq(users.appleSub, sub)).limit(1);
    return u;
  },
  async findByEmail(email) {
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return u;
  },
  async linkAppleSub(userId, sub) {
    await db.update(users).set({ appleSub: sub }).where(eq(users.id, userId));
  },
  async createUser(u) {
    await db.insert(users).values({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: null,
      locale: null,
      appleSub: u.appleSub,
      createdAt: u.createdAt,
      trialStartedAt: null,
      onboardedAt: null,
      googleCalendarAccessToken: null,
      googleCalendarRefreshToken: null,
      googleCalendarTokenExpires: null,
      googleCalendarSelectedIds: null,
    });
  },
  async provision(userId, locale) {
    await provisionNewUser(userId, { locale });
  },
};
```

- [ ] **Step 4: 跑測試確認全綠**

Run: `npx vitest run src/lib/auth/apple-account.test.ts`
Expected: 5 passed

- [ ] **Step 5: 原生 route 改用核心（行為不變）**

`src/app/api/auth/apple/route.ts`：保留 JWKS 驗簽與 `ALLOWED_AUDIENCES`，把 59-107 行的三段併號整段換成：

```ts
  const user = await resolveAppleUser(dbAppleAccountDeps, {
    sub,
    email,
    name: typeof fullName === "string" ? fullName : null,
    locale: bodyLocale ?? localeFromAcceptLanguage(request.headers.get("accept-language")),
  });
```

頂部 import 改為：

```ts
import { resolveAppleUser, dbAppleAccountDeps } from "@/lib/auth/apple-account";
```

並移除不再用的 `db/users/eq/nanoid/provisionNewUser` import（`localeFromAcceptLanguage` 留著）。**注意**：原 route 對「找到既有帳號」不覆寫 name/locale — `resolveAppleUser` 同樣不覆寫 ✓。

- [ ] **Step 6: 全量驗證 + Commit**

Run: `npm test && npx next build`
Expected: 全綠、build 成功

```bash
git add src/lib/auth/apple-account.ts src/lib/auth/apple-account.test.ts src/app/api/auth/apple/route.ts
git commit -m "refactor(auth): Apple 併號三段式抽成 resolveAppleUser（deps 注入可單測）"
```

---

### Task 2: Apple id_token 驗證 helper + client secret 簽發 script + env

**Files:**
- Create: `src/lib/auth/apple-jwt.ts`
- Create: `scripts/sign-apple-secret.mjs`
- Modify: `src/app/api/auth/apple/route.ts`（改用 helper）
- Modify: `.env.example`

**Interfaces:**
- Produces: `verifyAppleIdToken(idToken: string, audience: string | string[]): Promise<{ sub: string; email?: string; nonce?: string }>`。Task 3 用（audience = Services ID）。

- [ ] **Step 1: helper**

```ts
// src/lib/auth/apple-jwt.ts
/** Apple identityToken / id_token 驗簽 — JWKS 由 jose 內建快取。 */
import { createRemoteJWKSet, jwtVerify } from "jose";

const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

export async function verifyAppleIdToken(
  idToken: string,
  audience: string | string[]
): Promise<{ sub: string; email?: string; nonce?: string }> {
  const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
    issuer: "https://appleid.apple.com",
    audience,
  });
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("no subject in Apple token");
  }
  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    nonce: typeof payload.nonce === "string" ? payload.nonce : undefined,
  };
}
```

- [ ] **Step 2: 原生 route 改用 helper**

`src/app/api/auth/apple/route.ts`：刪掉檔內 `APPLE_JWKS` 與 `jose` import，try 區塊改：

```ts
  let sub: string;
  let tokenEmail: string | undefined;
  try {
    const verified = await verifyAppleIdToken(identityToken, ALLOWED_AUDIENCES);
    sub = verified.sub;
    tokenEmail = verified.email;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
```

import 加 `import { verifyAppleIdToken } from "@/lib/auth/apple-jwt";`。

- [ ] **Step 3: client secret 簽發 script**

```js
// scripts/sign-apple-secret.mjs
// AUTH_APPLE_SECRET 簽發：Apple client secret 是用 SIWA .p8 私鑰簽的
// ES256 JWT，效期上限 6 個月 — 到期前重跑本 script 更新 Zeabur env。
// 用法：node scripts/sign-apple-secret.mjs --key AuthKey_XXX.p8 --kid <KeyID> --iss <TeamID> --sub tw.nudge.web
import { SignJWT, importPKCS8 } from "jose";
import { readFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);
const missing = ["key", "kid", "iss", "sub"].filter((k) => !args[k]);
if (missing.length) {
  console.error(`缺參數：${missing.map((m) => `--${m}`).join(" ")}`);
  process.exit(1);
}

const pk = await importPKCS8(readFileSync(args.key, "utf8"), "ES256");
const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: args.kid })
  .setIssuer(args.iss)
  .setIssuedAt()
  .setExpirationTime("180d")
  .setAudience("https://appleid.apple.com")
  .setSubject(args.sub)
  .sign(pk);
console.log(jwt);
```

- [ ] **Step 4: .env.example**

在 `AUTH_URL` 之後加：

```bash
# Sign in with Apple（Web + Mac 中繼共用；未設 = 功能隱藏）
# AUTH_APPLE_ID = Apple Developer 的 Services ID（如 tw.nudge.web）
# AUTH_APPLE_SECRET = scripts/sign-apple-secret.mjs 簽出的 ES256 JWT（效期 ≤ 6 個月，到期重簽）
AUTH_APPLE_ID=
AUTH_APPLE_SECRET=
```

- [ ] **Step 5: 驗證 + Commit**

Run: `npm test && npx next build && node scripts/sign-apple-secret.mjs 2>&1 | head -1`
Expected: 測試綠、build 成功、script 印出「缺參數：--key --kid --iss --sub」

```bash
git add src/lib/auth/apple-jwt.ts scripts/sign-apple-secret.mjs src/app/api/auth/apple/route.ts .env.example
git commit -m "feat(auth): Apple id_token 驗證 helper + client secret 簽發 script"
```

---

### Task 3: Mac 中繼 endpoints（/start + /callback）

**Files:**
- Create: `src/app/api/auth/apple/start/route.ts`
- Create: `src/app/api/auth/apple/callback/route.ts`

**Interfaces:**
- Consumes: `verifyAppleIdToken`（Task 2）、`resolveAppleUser`/`dbAppleAccountDeps`（Task 1）、`signJWT`（既有 `@/lib/jwt`）、`localeFromAcceptLanguage`（既有 `@/lib/onboarding/provision-user`）。
- Produces: Mac 殼層（Task 5）依賴的 URL 合約 —— 開 `GET {base}/api/auth/apple/start?source=mac&locale=<tag>`；結果回 `nudge://auth/apple#token=<appJWT>` 或 `nudge://auth/apple#error=<cancelled|invalid|token_exchange|not_configured>`。

- [ ] **Step 1: /start**

```ts
// src/app/api/auth/apple/start/route.ts
/** Mac Sign in with Apple 中繼 — 第一段。
 *  Apple web OAuth 的 return URL 只能是註冊過的 https 網域（不能 custom
 *  scheme / localhost），所以 Mac 由伺服器中繼：這裡發 state+nonce cookie
 *  後 redirect Apple 授權頁；Apple form_post 回 /callback，那裡驗證、併號、
 *  簽 app JWT 再 redirect nudge:// 把 token 交回 app。
 *  模式對齊 /api/calendar/{mobile-start,connect,callback} 三段式。 */
import { NextRequest, NextResponse } from "next/server";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  // Apple 的 form_post 是跨站 POST，cookie 必須 SameSite=None 才會帶上。
  sameSite: "none" as const,
  maxAge: 300,
  path: "/api/auth/apple",
};

export async function GET(request: NextRequest) {
  const clientId = process.env.AUTH_APPLE_ID;
  if (!clientId || !process.env.AUTH_APPLE_SECRET) {
    return NextResponse.json({ error: "not configured" }, { status: 404 });
  }

  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const locale = request.nextUrl.searchParams.get("locale") ?? "";

  const authUrl = new URL("https://appleid.apple.com/auth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set(
    "redirect_uri",
    `${process.env.AUTH_URL}/api/auth/apple/callback`,
  );
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("response_mode", "form_post");
  authUrl.searchParams.set("scope", "name email");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("apple_auth_state", state, COOKIE_OPTS);
  res.cookies.set("apple_auth_nonce", nonce, COOKIE_OPTS);
  if (locale) res.cookies.set("apple_auth_locale", locale, COOKIE_OPTS);
  return res;
}
```

- [ ] **Step 2: /callback**

```ts
// src/app/api/auth/apple/callback/route.ts
/** Mac Sign in with Apple 中繼 — 第二段（Apple form_post 目的地）。
 *  驗 state → code 換 token → 驗 id_token 簽章與 nonce → resolveAppleUser
 *  併號 → 簽 app JWT → redirect nudge://auth/apple#token=…（fragment 不進
 *  server log）。錯誤一律 #error=<code>，殼層負責顯示；取消靜默。 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAppleIdToken } from "@/lib/auth/apple-jwt";
import { resolveAppleUser, dbAppleAccountDeps } from "@/lib/auth/apple-account";
import { signJWT } from "@/lib/jwt";

function toApp(fragment: string): NextResponse {
  // 303: POST → GET redirect。nudge:// 是合法絕對 URL，ASWebAuthenticationSession
  // 以 callbackURLScheme "nudge" 收下後關閉視窗。
  return NextResponse.redirect(`nudge://auth/apple${fragment}`, 303);
}

export async function POST(request: NextRequest) {
  const clientId = process.env.AUTH_APPLE_ID;
  const clientSecret = process.env.AUTH_APPLE_SECRET;
  if (!clientId || !clientSecret) return toApp("#error=not_configured");

  const form = await request.formData();

  if (form.get("error") === "user_cancelled_authorize") {
    return toApp("#error=cancelled");
  }

  const code = form.get("code");
  const state = form.get("state");
  const cookieState = request.cookies.get("apple_auth_state")?.value;
  const cookieNonce = request.cookies.get("apple_auth_nonce")?.value;
  if (
    typeof code !== "string" || !code ||
    typeof state !== "string" || !state ||
    !cookieState || state !== cookieState
  ) {
    return toApp("#error=invalid");
  }

  // code 換 token（client secret 與 NextAuth Apple provider 同一把）
  const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${process.env.AUTH_URL}/api/auth/apple/callback`,
    }),
  });
  if (!tokenRes.ok) {
    console.error("[apple/callback] token exchange failed:", tokenRes.status);
    return toApp("#error=token_exchange");
  }
  const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string };
  if (!idToken) return toApp("#error=token_exchange");

  let verified: Awaited<ReturnType<typeof verifyAppleIdToken>>;
  try {
    verified = await verifyAppleIdToken(idToken, clientId);
  } catch {
    return toApp("#error=invalid");
  }
  if (!cookieNonce || verified.nonce !== cookieNonce) {
    return toApp("#error=invalid");
  }

  // 首次授權 Apple 會在 form 帶 user JSON（name.firstName/lastName）
  let name: string | null = null;
  const userField = form.get("user");
  if (typeof userField === "string") {
    try {
      const parsed = JSON.parse(userField) as {
        name?: { firstName?: string; lastName?: string };
      };
      const combined = [parsed.name?.firstName, parsed.name?.lastName]
        .filter(Boolean)
        .join(" ");
      name = combined || null;
    } catch {}
  }

  const user = await resolveAppleUser(dbAppleAccountDeps, {
    sub: verified.sub,
    email: verified.email,
    name,
    locale: request.cookies.get("apple_auth_locale")?.value ?? null,
  });

  const token = await signJWT({ userId: user.id, email: user.email });
  const res = toApp(`#token=${token}`);
  res.cookies.delete("apple_auth_state");
  res.cookies.delete("apple_auth_nonce");
  res.cookies.delete("apple_auth_locale");
  return res;
}
```

- [ ] **Step 3: 驗證 + Commit**

Run: `npx next build && curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/auth/apple/start?source=mac"`（dev server 起著時；env 未設應回 404）
Expected: build 成功；404

```bash
git add src/app/api/auth/apple/start/route.ts src/app/api/auth/apple/callback/route.ts
git commit -m "feat(auth): Mac SIWA 伺服器中繼 endpoints（start/callback → nudge:// 交回 app JWT）"
```

---

### Task 4: NextAuth Apple provider + 登入頁按鈕 + i18n

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/app/[locale]/login/page.tsx`
- Modify: `i18n/canonical/zh-TW.json`（login 區塊）+ 跑 sync + 補 en/ja + xcstrings 鏡像

**Interfaces:**
- Consumes: `resolveAppleUser`/`dbAppleAccountDeps`（Task 1）。
- Produces: Web `/login` 的 Apple 按鈕（env-gated）；xcstrings `login.signInWithApple`（Task 5 Mac 按鈕用）。

- [ ] **Step 1: auth.ts — provider + 雙軌 signIn + jwt/session**

整檔改為：

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { provisionNewUser } from "@/lib/onboarding/provision-user";
import { resolveAppleUser, dbAppleAccountDeps } from "@/lib/auth/apple-account";

/** Web 介面語言（NEXT_LOCALE cookie，middleware 設）— seed 內容對齊。 */
async function webLocale(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    return cookieStore.get("NEXT_LOCALE")?.value ?? null;
  } catch {
    return null;
  }
}

// Apple provider 只在憑證齊時註冊（feature flag）— 未設時 /login 也不會
// 渲染 Apple 按鈕，現況不變。
const appleEnabled = !!(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google,
    ...(appleEnabled
      ? [
          Apple({
            clientId: process.env.AUTH_APPLE_ID,
            clientSecret: process.env.AUTH_APPLE_SECRET!,
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Apple：sub 優先併號（隱藏信箱 relay 也認得同一人）
        if (account?.provider === "apple") {
          const sub = profile?.sub;
          if (typeof sub !== "string" || !sub) return false;
          await resolveAppleUser(dbAppleAccountDeps, {
            sub,
            email:
              (typeof profile?.email === "string" ? profile.email : null) ??
              user.email,
            name: user.name ?? null,
            locale: await webLocale(),
          });
          return true;
        }

        // Google：維持 email 比對（Google email 穩定）
        if (!user.email) return false;

        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        if (!existing) {
          const now = new Date().toISOString();
          const newUserId = nanoid();
          await db.insert(users).values({
            id: newUserId,
            email: user.email,
            name: user.name || null,
            avatarUrl: user.image || null,
            locale: null,
            appleSub: null,
            createdAt: now,
            googleCalendarAccessToken: null,
            googleCalendarRefreshToken: null,
            googleCalendarTokenExpires: null,
            googleCalendarSelectedIds: null,
          });
          await provisionNewUser(newUserId, { locale: await webLocale() });
        }

        return true;
      } catch (e) {
        console.error("signIn callback error:", e);
        return false;
      }
    },
    // 登入當下就把 db user id 釘進 NextAuth JWT — session 不再靠 email
    // 現查（Apple 隱藏信箱帳號的 email 是 relay 位址，用 sub 查才穩）。
    async jwt({ token, account, profile }) {
      try {
        if (account) {
          if (account.provider === "apple" && typeof profile?.sub === "string") {
            const [u] = await db
              .select()
              .from(users)
              .where(eq(users.appleSub, profile.sub))
              .limit(1);
            if (u) {
              token.userId = u.id;
              token.email = u.email;
            }
          } else if (token.email) {
            const [u] = await db
              .select()
              .from(users)
              .where(eq(users.email, token.email))
              .limit(1);
            if (u) token.userId = u.id;
          }
        }
      } catch (e) {
        console.error("jwt callback error:", e);
      }
      return token;
    },
    async session({ session, token }) {
      try {
        if (typeof token.userId === "string") {
          session.user.id = token.userId;
          return session;
        }
        // 舊 session（升級前簽發、無 userId）fallback：email 現查一次
        if (session.user?.email) {
          const [dbUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, session.user.email))
            .limit(1);
          if (dbUser) session.user.id = dbUser.id;
        }
      } catch (e) {
        console.error("session callback error:", e);
      }
      return session;
    },
  },
});
```

- [ ] **Step 2: i18n key**

`i18n/canonical/zh-TW.json` 的 `login` 區塊加：

```json
"signInWithApple": "使用 Apple 帳號登入"
```

跑 `npm run i18n:sync`；到 `i18n/.pending-translations.md` 確認列出後，把翻譯補進對應 canonical（en：`Sign in with Apple`、ja：`Appleでサインイン`），再跑一次 `npm run i18n:sync`。最後 xcstrings 鏡像：`apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings` 加 `login.signInWithApple`（zh-Hant 使用 Apple 帳號登入 / en Sign in with Apple / ja Appleでサインイン），照既有 key 的 JSON 結構。

- [ ] **Step 3: 登入頁 Apple 按鈕**

`src/app/[locale]/login/page.tsx` 的 Google `</form>` 之後加（同層）：

```tsx
        {process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET && (
          <form
            action={async () => {
              "use server";
              await signIn("apple", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-3 rounded-lg bg-black px-6 py-3 text-sm font-medium text-white shadow hover:bg-gray-900 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 12.54c-.03-2.94 2.4-4.35 2.51-4.42-1.37-2-3.5-2.28-4.25-2.31-1.8-.18-3.53 1.06-4.44 1.06-.92 0-2.34-1.04-3.85-1.01-1.98.03-3.81 1.15-4.83 2.92-2.06 3.58-.53 8.87 1.48 11.77.98 1.42 2.15 3.01 3.68 2.95 1.48-.06 2.04-.95 3.83-.95 1.78 0 2.29.95 3.85.92 1.59-.03 2.6-1.44 3.57-2.87 1.13-1.64 1.59-3.23 1.61-3.31-.03-.02-3.09-1.19-3.16-4.75zM14.13 3.9c.82-.99 1.37-2.37 1.22-3.74-1.18.05-2.6.78-3.45 1.77-.76.88-1.42 2.28-1.24 3.63 1.31.1 2.65-.67 3.47-1.66z"/>
              </svg>
              {t("signInWithApple")}
            </button>
          </form>
        )}
```

外層 `space-y-8` 的第二個 div 需要把兩個 form 包成 `<div className="flex flex-col items-center gap-3">`（Google form 移入同容器），保持垂直排列與間距。

- [ ] **Step 4: 驗證 + Commit**

Run: `npm test && npx next build && npm run i18n:check`
Expected: 全綠。手動：dev server 開 `/login`（env 未設）→ 只有 Google 按鈕（現況不變）。

```bash
git add src/lib/auth.ts src/app/[locale]/login/page.tsx i18n/ src/messages/ mobile/lib/l10n/ apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings
git commit -m "feat(web): NextAuth Apple provider（sub 優先併號）+ 登入頁 Apple 按鈕（env-gated）"
```

---

### Task 5: Mac 殼層（AppleSignInService + LoginView 按鈕 + 接線）

**Files:**
- Create: `apple/Nudge-macOS/AppleSignInService+macOS.swift`
- Modify: `apple/NudgeKit/Sources/NudgeCore/AuthRepository.swift`（加 `loginWithAppleToken`）
- Modify: `apple/NudgeKit/Sources/NudgeUI/LoginView.swift`（macOS Apple 按鈕 + 新 closure）
- Modify: `apple/NudgeKit/Sources/NudgeUI/AuthGateView.swift`（傳遞新 closure）
- Modify: `apple/Nudge-macOS/NudgeMacApp.swift`（service + performAppleWebLogin）

**Interfaces:**
- Consumes: Task 3 的 URL 合約（`/start?source=mac&locale=`、`nudge://auth/apple#token|#error`）。
- Produces: `AppleSignInServiceMacOS.signIn(locale:) async throws -> String`（回 app JWT；取消 throw `.canceled`）；`AuthRepository.loginWithAppleToken(_:)`；`LoginView`/`AuthGateView` 新增 optional `onAppleWebLogin` closure（預設 nil，iOS 呼叫端不用改）。

- [ ] **Step 1: AppleSignInService+macOS.swift**

```swift
import AppKit
import AuthenticationServices
import Foundation
import NudgeCore

/// Mac 的 Sign in with Apple — 走伺服器中繼 web OAuth，**不用**原生
/// AuthenticationServices SIWA（restricted entitlement 在 Developer ID
/// 分發會 AMFI SIGKILL）。流程：開 {base}/api/auth/apple/start →
/// Apple 授權 → 後端驗證併號簽 app JWT → redirect nudge://auth/apple
/// #token=…，這裡取 token 回傳。
///
/// 併發規則照 GoogleSignInServiceMacOS：class 非 @MainActor、
/// ASWebAuthenticationSession callback 只 cont.resume、碰 NSApp/NSWindow
/// 一律 DispatchQueue.main.async（違反 → dispatch_assert_queue SIGTRAP）。
final class AppleSignInServiceMacOS: NSObject, @unchecked Sendable {
    enum AppleWebSignInError: Error, LocalizedError {
        case canceled
        case server(String)
        case platform(Error)

        var errorDescription: String? {
            switch self {
            case .canceled: return nil
            case .server(let code): return "Apple sign-in failed (\(code))"
            case .platform(let error): return error.localizedDescription
            }
        }
    }

    private let baseURL: URL

    init(baseURL: URL) {
        self.baseURL = baseURL
        super.init()
    }

    /// 回傳後端簽好的 app JWT。使用者取消 → throw .canceled（呼叫端靜默）。
    func signIn(locale: String?) async throws -> String {
        var comps = URLComponents(
            url: baseURL.appendingPathComponent("api/auth/apple/start"),
            resolvingAgainstBaseURL: false
        )!
        var query = [URLQueryItem(name: "source", value: "mac")]
        if let locale, !locale.isEmpty {
            query.append(URLQueryItem(name: "locale", value: locale))
        }
        comps.queryItems = query
        let authURL = comps.url!

        let callbackURL: URL = try await withCheckedThrowingContinuation { (cont: CheckedContinuation<URL, Error>) in
            DispatchQueue.main.async {
                guard let window = NSApp.keyWindow ?? NSApp.windows.first else {
                    cont.resume(throwing: AppleWebSignInError.platform(NSError(
                        domain: "AppleOAuth", code: -10,
                        userInfo: [NSLocalizedDescriptionKey: "no window available"]
                    )))
                    return
                }

                let session = ASWebAuthenticationSession(
                    url: authURL,
                    callbackURLScheme: "nudge"
                ) { url, error in
                    // 背景 XPC queue — 只能 cont.resume，不碰 main-only API。
                    if let url {
                        cont.resume(returning: url)
                    } else if let nsError = error as NSError?,
                              nsError.domain == ASWebAuthenticationSessionErrorDomain,
                              nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                        cont.resume(throwing: AppleWebSignInError.canceled)
                    } else {
                        cont.resume(throwing: AppleWebSignInError.platform(
                            error ?? NSError(domain: "AppleOAuth", code: -1,
                                             userInfo: [NSLocalizedDescriptionKey: "no callback URL"])
                        ))
                    }
                }

                let provider = AppleMacOSContextProvider(window: window)
                session.presentationContextProvider = provider
                objc_setAssociatedObject(session, &Self.providerKey, provider, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
                session.prefersEphemeralWebBrowserSession = false
                if !session.start() {
                    cont.resume(throwing: AppleWebSignInError.platform(NSError(
                        domain: "AppleOAuth", code: -2,
                        userInfo: [NSLocalizedDescriptionKey: "ASWebAuthenticationSession failed to start"]
                    )))
                }
            }
        }

        // nudge://auth/apple#token=… / #error=…
        guard let cb = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
              let fragment = cb.fragment else {
            throw AppleWebSignInError.server("no_fragment")
        }
        var params: [String: String] = [:]
        for pair in fragment.split(separator: "&") {
            let kv = pair.split(separator: "=", maxSplits: 1)
            if kv.count == 2 {
                params[String(kv[0])] = String(kv[1]).removingPercentEncoding ?? String(kv[1])
            }
        }
        if let errorCode = params["error"] {
            if errorCode == "cancelled" { throw AppleWebSignInError.canceled }
            throw AppleWebSignInError.server(errorCode)
        }
        guard let token = params["token"], !token.isEmpty else {
            throw AppleWebSignInError.server("no_token")
        }
        return token
    }

    private static var providerKey: UInt8 = 0
}

/// 同 GoogleSignInService+macOS 的 provider：init 時抓 NSWindow，之後任何
/// thread 直接 return，不做 actor hop。
private final class AppleMacOSContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding, @unchecked Sendable {
    private let capturedWindow: NSWindow

    init(window: NSWindow) {
        self.capturedWindow = window
        super.init()
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return capturedWindow
    }
}
```

- [ ] **Step 2: AuthRepository.loginWithAppleToken**

`AuthRepository.swift` 的 `loginWithApple(...)` 之後加：

```swift
    /// Mac web 中繼 Apple 登入：後端已完成併號並簽好 app JWT，這裡只
    /// 存 keychain → 打 /api/me 取 user（tokenProvider 會從 keychain 帶
    /// Bearer）。失敗回滾 token 避免殘留壞憑證。
    @discardableResult
    public func loginWithAppleToken(_ token: String) async throws -> UserDTO {
        try keychain.set(token, for: tokenKey)
        do {
            let user: UserDTO = try await client.get("/api/me")
            entitlement = user.entitlement
            status = .authenticated(user)
            return user
        } catch {
            try? keychain.remove(for: tokenKey)
            throw error
        }
    }
```

- [ ] **Step 3: LoginView — 新 closure + macOS 按鈕**

`LoginView.swift`：

property 區（`onAppleLogin` 之後）加：

```swift
    /// macOS 的 web 中繼 Apple 登入 — 殼層完成整個流程（開瀏覽器→拿 app
    /// JWT→寫 auth state），View 只觸發。nil = 不顯示按鈕（iOS 用不到）。
    public var onAppleWebLogin: (() async -> Result<Void, Error>)?
```

`init` 加參數（預設 nil，iOS 呼叫端不用改）：

```swift
    public init(
        onLoginTapped: @escaping () async -> Result<Void, Error>,
        onAppleLogin: @escaping (_ identityToken: String, _ fullName: String?, _ email: String?) async -> Result<Void, Error>,
        onAppleWebLogin: (() async -> Result<Void, Error>)? = nil
    ) {
        self.onLoginTapped = onLoginTapped
        self.onAppleLogin = onAppleLogin
        self.onAppleWebLogin = onAppleWebLogin
    }
```

body 的按鈕區塊改：

```swift
                googleButton
                // iOS：原生 SignInWithAppleButton（App Store 4.8）。
                // macOS：web 中繼流程的自訂按鈕（原生 SIWA 是 restricted
                // entitlement，Developer ID 分發會 AMFI SIGKILL）。
                #if os(iOS)
                appleButton
                #else
                if onAppleWebLogin != nil {
                    macAppleButton
                }
                #endif
```

`googleButton` 之後加（`#if os(macOS)` 區塊）：

```swift
    #if os(macOS)
    private var macAppleButton: some View {
        Button {
            guard let onAppleWebLogin else { return }
            Task {
                isLoading = true
                errorMessage = nil
                let result = await onAppleWebLogin()
                isLoading = false
                if case .failure(let error) = result {
                    errorMessage = (error as? LocalizedError)?.errorDescription
                        ?? error.localizedDescription
                }
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "apple.logo")
                    .nudgeFont(.rowTitleEmphasized)
                Text("login.signInWithApple", bundle: .module)
                    .nudgeFont(.rowTitleEmphasized)
            }
            // Apple HIG 官方樣式：淺色模式黑底白字、深色模式白底黑字。
            // 品牌按鈕例外，不走 token。
            .foregroundStyle(colorScheme == .dark ? Color.black : Color.white) // nudge:allow-color
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .contentShape(Capsule())
            .background(
                Capsule().fill(colorScheme == .dark ? Color.white : Color.black) // nudge:allow-color
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
    #endif
```

- [ ] **Step 4: AuthGateView 傳遞**

```swift
    let onAppleWebLoginRequested: (() async -> Result<Void, Error>)?

    public init(
        auth: AuthRepository,
        onLoginRequested: @escaping () async -> Result<Void, Error>,
        onAppleLoginRequested: @escaping (_ identityToken: String, _ fullName: String?, _ email: String?) async -> Result<Void, Error>,
        onAppleWebLoginRequested: (() async -> Result<Void, Error>)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.auth = auth
        self.onLoginRequested = onLoginRequested
        self.onAppleLoginRequested = onAppleLoginRequested
        self.onAppleWebLoginRequested = onAppleWebLoginRequested
        self.content = content
    }
```

`LoginView(` 呼叫處加 `onAppleWebLogin: onAppleWebLoginRequested`。

- [ ] **Step 5: NudgeMacApp 接線**

property 區加：

```swift
    private let appleSignIn = AppleSignInServiceMacOS(baseURL: APIConfiguration.default.baseURL)
```

`AuthGateView(` 呼叫加 `onAppleWebLoginRequested: performAppleWebLogin,`（放 `onAppleLoginRequested:` 之後）。

`performAppleLogin` 之後加：

```swift
    private func performAppleWebLogin() async -> Result<Void, Error> {
        do {
            let token = try await appleSignIn.signIn(locale: NudgeLanguage.currentUITag())
            _ = try await auth.loginWithAppleToken(token)
            return .success(())
        } catch AppleSignInServiceMacOS.AppleWebSignInError.canceled {
            // 使用者自己取消：靜默（對齊 iOS 原生行為）
            return .success(())
        } catch {
            return .failure(error)
        }
    }
```

- [ ] **Step 6: Build 驗證（swift build 不夠，必須 full target build）**

```bash
cd apple/NudgeKit && swift build
cd .. && xcodegen generate
xcodebuild -project Nudge.xcodeproj -scheme Nudge-macOS -configuration Debug build
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'generic/platform=iOS Simulator' -configuration Debug build
```
Expected: 全部成功（iOS build 確認 default 參數沒破壞既有呼叫端）。

- [ ] **Step 7: Commit**

```bash
git add apple/Nudge-macOS/AppleSignInService+macOS.swift apple/Nudge-macOS/NudgeMacApp.swift apple/NudgeKit/Sources/NudgeCore/AuthRepository.swift apple/NudgeKit/Sources/NudgeUI/LoginView.swift apple/NudgeKit/Sources/NudgeUI/AuthGateView.swift
git commit -m "feat(mac): Sign in with Apple（web 中繼 + ASWebAuthenticationSession）"
```

---

### Task 6: 端到端驗證（DoD）

**Files:** 無；驗收 task。

- [ ] **Step 1: 全量自動驗證**

```bash
npm test && npx next build && npm run lint
cd apple/NudgeKit && swift test
```
Expected: vitest 全綠（含新 5 案例）、build 成功、lint 我方檔案零新增問題、swift 既有測試不退步。

- [ ] **Step 2: 本機迴歸（env 未設 = 功能隱藏）**

1. Web `/login`（dev server）→ 只有 Google 按鈕、Google 登入正常。
2. `curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/auth/apple/start` → 404。
3. Mac Debug app：登入頁出現 Apple 黑色按鈕（Mac 不做 flag）；點了會進 `/start` 拿到 404 → 顯示錯誤紅字（預期，憑證未設）。Google 登入正常。
4. iOS 模擬器 build 過（原生 SIWA 無法在 sim CLI build 測 — 既有限制，entitlement 被剝會 error 1000；只驗編譯與 UI 不變）。

- [ ] **Step 3: 外部前置（Mike，照 spec「外部前置」五步）**

Services ID `tw.nudge.web`（群組到 `tw.nudge.app` primary）→ domain/return URLs（`/api/auth/callback/apple` + `/api/auth/apple/callback`）→ SIWA Key .p8 → `node scripts/sign-apple-secret.mjs ...` → Zeabur 填 `AUTH_APPLE_ID`/`AUTH_APPLE_SECRET`。

- [ ] **Step 4: Prod 端到端（憑證就位後）**

1. Web `/login` 出現 Apple 按鈕 → 新 Apple ID 登入 → 建號 + onboarding seed。
2. 用「iOS 已註冊過的 Apple ID」在 Web 登入 → 同一帳號（設定頁 email 一致）。
3. Mac Apple 登入 → 同上兩情境；授權頁按取消 → 無紅字。
4. 核心驗收：iPhone Apple（隱藏信箱）付費帳號 → Mac Apple 登入 → 同帳號、entitlement 可見。
5. NextAuth 已知風險點：若 Web Apple 登入被彈回 `/login`（state cookie 掉了），在 `NextAuth({...})` 加：

```ts
  cookies: {
    pkceCodeVerifier: { options: { sameSite: "none", secure: true } },
    state: { options: { sameSite: "none", secure: true } },
    nonce: { options: { sameSite: "none", secure: true } },
  },
```

（Apple form_post 是跨站 POST，部分環境需顯式 SameSite=None。）

- [ ] **Step 5: 回報 + 收尾**

驗收清單結果回報使用者；過了才走 PR/merge 流程。

import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { signJWT } from "@/lib/jwt";

// Apple 的公鑰集 —— 驗 identityToken 簽章用。createRemoteJWKSet 內建快取
// （依 Cache-Control），不會每次 request 都打 Apple。
const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

// 原生 app 的 bundle id = Apple identityToken 的 aud（iOS / macOS 各一）。
const ALLOWED_AUDIENCES = ["tw.nudge.app", "tw.nudge.mac"];

// 原生 Sign in with Apple：app 拿到 Apple identityToken（JWT）後 POST 上來，
// 後端驗 Apple 簽章 → 連結/建帳號 → 簽我們自己的 app JWT。結構與
// /api/auth/mobile（Google）對稱。
//
// 連結策略：① apple_sub 命中既有帳號 → 用之；② 否則 token 有 email 且該
// email 已有帳號 → 把 apple_sub 補上去（email 併號）；③ 否則建新帳號
// （Apple「隱藏信箱」relay 地址會走這條、自成一帳號）。
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { identityToken, fullName, email: bodyEmail } = body;

  if (!identityToken) {
    return NextResponse.json(
      { error: "identityToken required" },
      { status: 400 },
    );
  }

  let sub: string;
  let tokenEmail: string | undefined;
  try {
    const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience: ALLOWED_AUDIENCES,
    });
    sub = payload.sub as string;
    tokenEmail = typeof payload.email === "string" ? payload.email : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (!sub) {
    return NextResponse.json({ error: "No subject in token" }, { status: 401 });
  }

  // email 只有「首次授權」才一定有（token 內或 app 帶上）；之後可能都沒有。
  const email = tokenEmail ?? (typeof bodyEmail === "string" ? bodyEmail : undefined);

  // ① apple_sub 命中
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.appleSub, sub))
    .limit(1);

  // ② 沒命中但 email 對得上既有帳號 → 併號（補 apple_sub）
  if (!user && email) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing) {
      await db
        .update(users)
        .set({ appleSub: sub })
        .where(eq(users.id, existing.id));
      user = { ...existing, appleSub: sub };
    }
  }

  // ③ 建新帳號
  if (!user) {
    const now = new Date().toISOString();
    const newUser = {
      id: nanoid(),
      // relay 信箱也照存；真的沒 email（罕見）就給個穩定 placeholder 滿足
      // NOT NULL/unique，使用者之後仍能用 Apple 登入（靠 apple_sub）。
      email: email ?? `${sub}@appleid.nudge.local`,
      name: typeof fullName === "string" && fullName.trim() ? fullName.trim() : null,
      avatarUrl: null,
      locale: null,
      appleSub: sub,
      createdAt: now,
      googleCalendarAccessToken: null,
      googleCalendarRefreshToken: null,
      googleCalendarTokenExpires: null,
      googleCalendarSelectedIds: null,
    };
    await db.insert(users).values(newUser);
    user = newUser;
  }

  const token = await signJWT({ userId: user.id, email: user.email });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
    },
  });
}

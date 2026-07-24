import { NextRequest, NextResponse } from "next/server";
import { signJWT } from "@/lib/jwt";
import { localeFromAcceptLanguage } from "@/lib/onboarding/provision-user";
import { resolveAppleUser, dbAppleAccountDeps } from "@/lib/auth/apple-account";
import { verifyAppleIdToken } from "@/lib/auth/apple-jwt";

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
  // app 帶上的介面語言優先（比 Accept-Language 準）。
  const bodyLocale = typeof body.locale === "string" ? body.locale : null;

  if (!identityToken) {
    return NextResponse.json(
      { error: "identityToken required" },
      { status: 400 },
    );
  }

  let sub: string;
  let tokenEmail: string | undefined;
  try {
    const verified = await verifyAppleIdToken(identityToken, ALLOWED_AUDIENCES);
    sub = verified.sub;
    tokenEmail = verified.email;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // email 只有「首次授權」才一定有（token 內或 app 帶上）；之後可能都沒有。
  const email = tokenEmail ?? (typeof bodyEmail === "string" ? bodyEmail : undefined);

  // 三段併號（① sub 命中 → ② email 併號 → ③ 建新帳號）抽到共用核心，
  // 與 web NextAuth / Mac 中繼 callback 共用同一份邏輯。
  const user = await resolveAppleUser(dbAppleAccountDeps, {
    sub,
    email,
    name: typeof fullName === "string" ? fullName : null,
    locale: bodyLocale ?? localeFromAcceptLanguage(request.headers.get("accept-language")),
  });

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

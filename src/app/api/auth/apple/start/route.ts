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

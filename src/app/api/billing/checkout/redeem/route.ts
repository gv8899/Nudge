// OTT 兌換（瀏覽器 GET）：驗一次性 token → 設 30 分鐘 checkout cookie →
// redirect /paywall（無 locale 前綴，交給 next-intl middleware 依 NEXT_LOCALE
// / Accept-Language 補）。失敗 → /login?checkout=expired。
//
// 順手把 user.locale 同步進 NEXT_LOCALE cookie（鏡像 /api/me 行為），讓 Mac
// 用戶落地的 /paywall 語言 = 他 app 內的語言。

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  CHECKOUT_COOKIE,
  verifyCheckoutToken,
  issueCheckoutCookieJWT,
} from "@/lib/checkout-session";

export async function GET(request: NextRequest) {
  const ott = request.nextUrl.searchParams.get("ott") ?? "";
  const userId = await verifyCheckoutToken(ott);
  const base = request.nextUrl.origin;

  if (!userId) {
    return NextResponse.redirect(`${base}/login?checkout=expired`);
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return NextResponse.redirect(`${base}/login?checkout=expired`);
  }

  const res = NextResponse.redirect(`${base}/paywall`);
  res.cookies.set(CHECKOUT_COOKIE, await issueCheckoutCookieJWT(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60,
  });
  if (user.locale) {
    res.cookies.set("NEXT_LOCALE", user.locale, {
      httpOnly: false,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}

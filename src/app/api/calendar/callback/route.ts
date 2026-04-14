import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { exchangeCode } from "@/lib/google-calendar/oauth";
import { encrypt } from "@/lib/google-calendar/crypto";
import { listCalendars } from "@/lib/google-calendar/api";

function errorRedirect(reason: string) {
  const url = new URL("/", process.env.NEXTAUTH_URL || "http://localhost:3000");
  url.searchParams.set("calendar", "error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("calendar_oauth_state")?.value;
  const cookieUserId = req.cookies.get("calendar_oauth_user")?.value;
  const cookieSource = req.cookies.get("calendar_oauth_source")?.value;

  if (!code || !state || !cookieState || state !== cookieState || !cookieUserId) {
    return errorRedirect("invalid_state");
  }

  try {
    const tokens = await exchangeCode(code);
    // 找出真正的 primary calendar id（就是使用者的 email），存實際 id 而不是 "primary" 字面
    let defaultSelected: string[] = ["primary"];
    try {
      const cals = await listCalendars(tokens.accessToken);
      const primary = cals.find((c) => c.primary);
      if (primary) defaultSelected = [primary.id];
    } catch (e) {
      console.warn("callback listCalendars failed, falling back to 'primary' alias:", e);
    }
    await db
      .update(users)
      .set({
        googleCalendarAccessToken: encrypt(tokens.accessToken),
        googleCalendarRefreshToken: encrypt(tokens.refreshToken),
        googleCalendarTokenExpires: tokens.expiresAt.toISOString(),
        googleCalendarSelectedIds: JSON.stringify(defaultSelected),
      })
      .where(eq(users.id, cookieUserId));
  } catch (e) {
    console.error("calendar callback exchange failed:", e);
    return errorRedirect("exchange_failed");
  }

  // Mobile 流程 → redirect 到 nudge:// 深層連結，
  // ASWebAuthenticationSession 看到 callback scheme 會自動關閉並切回 App
  if (cookieSource === "mobile") {
    const res = NextResponse.redirect("nudge://calendar/connected");
    res.cookies.delete("calendar_oauth_state");
    res.cookies.delete("calendar_oauth_user");
    res.cookies.delete("calendar_oauth_source");
    return res;
  }

  // Web 流程 → 導回首頁
  const url = new URL("/", process.env.NEXTAUTH_URL || "http://localhost:3000");
  url.searchParams.set("calendar", "connected");
  const res = NextResponse.redirect(url);
  res.cookies.delete("calendar_oauth_state");
  res.cookies.delete("calendar_oauth_user");
  res.cookies.delete("calendar_oauth_source");
  return res;
}

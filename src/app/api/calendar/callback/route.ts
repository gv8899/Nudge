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

const MOBILE_SUCCESS_HTML = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>已連結 Google Calendar</title>
<style>
  html,body{margin:0;height:100%;background:#1c1b18;color:#ebe5d4;font-family:-apple-system,system-ui,sans-serif}
  .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;gap:12px}
  .icon{width:56px;height:56px;border-radius:28px;background:#c89968;display:flex;align-items:center;justify-content:center;font-size:28px}
  h1{margin:8px 0 0;font-size:18px;font-weight:600}
  p{margin:0;color:#9b9485;font-size:14px;line-height:1.5;max-width:280px}
</style>
</head>
<body>
  <div class="wrap">
    <div class="icon">✓</div>
    <h1>已連結 Google Calendar</h1>
    <p>你可以關閉這個分頁，回到 Nudge App。</p>
  </div>
</body>
</html>`;

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

  // Mobile 流程 → 回靜態成功頁，指示使用者回到 App
  if (cookieSource === "mobile") {
    const res = new NextResponse(MOBILE_SUCCESS_HTML, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
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

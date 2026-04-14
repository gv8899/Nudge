import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { exchangeCode } from "@/lib/google-calendar/oauth";
import { encrypt } from "@/lib/google-calendar/crypto";

function errorRedirect(reason: string) {
  const url = new URL("/", process.env.NEXTAUTH_URL || "http://localhost:3000");
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

  const url = new URL("/", process.env.NEXTAUTH_URL || "http://localhost:3000");
  url.searchParams.set("calendar", "connected");
  const res = NextResponse.redirect(url);
  res.cookies.delete("calendar_oauth_state");
  return res;
}

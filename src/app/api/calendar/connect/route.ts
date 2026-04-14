import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getUser } from "@/lib/get-user";
import { verifyJWT } from "@/lib/jwt";
import { buildAuthUrl } from "@/lib/google-calendar/oauth";

export async function GET(req: NextRequest) {
  // 優先檢查 ticket 參數（mobile 一次性 ticket flow）
  let userId: string | null = null;
  const ticket = req.nextUrl.searchParams.get("ticket");
  if (ticket) {
    try {
      const payload = await verifyJWT(ticket);
      if (payload.purpose === "calendar-connect" && payload.userId) {
        userId = payload.userId;
      }
    } catch {
      // ticket 無效或過期 → fallback 到 session
    }
  }

  // Fallback：檢查 session（web 流程）
  if (!userId) {
    const user = await getUser();
    if (!user) {
      return NextResponse.redirect(
        new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000")
      );
    }
    userId = user.id;
  }

  const state = randomBytes(24).toString("hex");
  const url = buildAuthUrl(state);

  const response = NextResponse.redirect(url);
  // state + userId 都存 httpOnly cookie，callback 會讀 userId 決定要更新哪個使用者
  response.cookies.set("calendar_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/calendar",
    maxAge: 600,
  });
  response.cookies.set("calendar_oauth_user", userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/calendar",
    maxAge: 600,
  });
  // 若是 mobile ticket 流程，callback 要回靜態成功頁而非 redirect 到 /
  if (ticket) {
    response.cookies.set("calendar_oauth_source", "mobile", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/calendar",
      maxAge: 600,
    });
  }
  return response;
}

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

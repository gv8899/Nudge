import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/get-user";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 同步 user.locale 到 NEXT_LOCALE cookie，讓 next-intl middleware
  // 能依使用者偏好 redirect 到正確 /[locale]/... 路徑
  if (user.locale) {
    const cookieStore = await cookies();
    if (cookieStore.get("NEXT_LOCALE")?.value !== user.locale) {
      cookieStore.set("NEXT_LOCALE", user.locale, {
        httpOnly: false,
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    createdAt: user.createdAt,
  });
}

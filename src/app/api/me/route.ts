import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/get-user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getEntitlement } from "@/lib/entitlement";

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

  const entitlement = await getEntitlement(user.id);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    createdAt: user.createdAt,
    entitlement,
  });
}

// 刪除帳號（App Store 5.1.1(v) 強制：能建帳號就要能刪）。所有 user-scoped
// 表都 onDelete: cascade（tasks / recurrences / tags / assignments…），刪
// users 一筆即 cascade 清乾淨。
export async function DELETE() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await db.delete(users).where(eq(users.id, user.id));
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getUser } from "@/lib/get-user";

const SUPPORTED = ["zh-TW", "en", "ja"] as const;
type SupportedLocale = (typeof SUPPORTED)[number];

function isSupported(v: unknown): v is SupportedLocale {
  return typeof v === "string" && (SUPPORTED as readonly string[]).includes(v);
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const locale = (body as Record<string, unknown>)?.locale;
  // null 允許（表示清除偏好、跟隨系統 / Accept-Language）
  if (locale !== null && !isSupported(locale)) {
    return NextResponse.json(
      { error: "Unsupported locale", supported: SUPPORTED },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set({ locale: locale as string | null })
    .where(eq(users.id, user.id));

  // 寫入 NEXT_LOCALE cookie，middleware 下次 request 會自動 redirect
  const cookieStore = await cookies();
  if (locale === null) {
    cookieStore.delete("NEXT_LOCALE");
  } else {
    cookieStore.set("NEXT_LOCALE", locale as string, {
      httpOnly: false,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return NextResponse.json({ locale });
}

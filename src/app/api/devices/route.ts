import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deviceTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import { nanoid } from "nanoid";

const PLATFORMS = ["ios", "macos"] as const;
const ENVIRONMENTS = ["sandbox", "production"] as const;

/**
 * POST /api/devices — App 註冊 / 更新 APNs device token（即時同步 silent
 * push 用）。token 全域唯一：同一台裝置換帳號登入時 upsert 會把歸屬改到
 * 新 user（舊帳號不該再收到這台裝置的推播）。
 *
 * body: { token: string, platform: "ios"|"macos", environment?: "sandbox"|"production" }
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const platform = body?.platform;
  const environment = body?.environment ?? "production";

  if (!token || token.length > 200) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  if (!PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  if (!ENVIRONMENTS.includes(environment)) {
    return NextResponse.json({ error: "Invalid environment" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await db
    .insert(deviceTokens)
    .values({
      id: nanoid(),
      userId: user.id,
      token,
      platform,
      environment,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: deviceTokens.token,
      set: { userId: user.id, platform, environment, updatedAt: now },
    });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/devices — 登出時註銷這台裝置的 token。
 * body: { token: string }
 */
export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  await db.delete(deviceTokens).where(eq(deviceTokens.token, token));
  return NextResponse.json({ ok: true });
}

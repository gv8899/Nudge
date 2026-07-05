import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import { notifyUserDevices } from "@/lib/notify-devices";

const DEFAULTS = {
  morningEnabled: true,
  morningTime: "09:00",
  morningContent: "summary" as const,
  eveningEnabled: true,
  eveningTime: "21:00",
  eveningContent: "incomplete" as const,
  perTaskRemindersEnabled: true,
};

/**
 * GET /api/notification-preferences — 該 user 的通知偏好。沒設過時回
 * defaults (但不寫進 DB；第一次 PATCH 才 insert)。
 */
export async function GET() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pref] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, user.id))
    .limit(1);

  if (pref) return NextResponse.json(pref);
  return NextResponse.json({
    userId: user.id,
    ...DEFAULTS,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * PATCH /api/notification-preferences — partial update。第一次寫入時用
 * defaults 補齊未指定欄位。
 */
export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const now = new Date().toISOString();

  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, user.id))
    .limit(1);

  const allowed = [
    "morningEnabled",
    "morningTime",
    "morningContent",
    "eveningEnabled",
    "eveningTime",
    "eveningContent",
    "perTaskRemindersEnabled",
  ] as const;
  const updates: Record<string, unknown> = { updatedAt: now };
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (existing) {
    await db
      .update(notificationPreferences)
      .set(updates)
      .where(eq(notificationPreferences.userId, user.id));
  } else {
    await db.insert(notificationPreferences).values({
      userId: user.id,
      morningEnabled: DEFAULTS.morningEnabled,
      morningTime: DEFAULTS.morningTime,
      morningContent: DEFAULTS.morningContent,
      eveningEnabled: DEFAULTS.eveningEnabled,
      eveningTime: DEFAULTS.eveningTime,
      eveningContent: DEFAULTS.eveningContent,
      perTaskRemindersEnabled: DEFAULTS.perTaskRemindersEnabled,
      ...(updates as Record<string, never>),
      updatedAt: now,
    });
  }

  const [saved] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, user.id))
    .limit(1);
  // 通知偏好變動也推 —— 讓另一台裝置背景重排早/晚摘要與提醒。
  notifyUserDevices(user.id);
  return NextResponse.json(saved);
}

// Paddle webhook — 驗簽 + 冪等（webhook_events 去重）+ 亂序防護，事件經
// mapPaddleEvent 收斂到既有 grantAccess 單一寫入點。
//
// 回應策略：
//   400 = 簽章壞（Paddle 會重試；連續失敗要查 secret）
//   503 = Paddle env 未設定
//   200 = 已處理 / 重複 / no-op / 查無 user（後者 log 供人工對帳，不讓 Paddle 無限重送）
//   500 = 未預期錯誤（讓 Paddle 重試）

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhookEvents, subscriptions, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { grantAccess } from "@/lib/entitlement";
import {
  getPaddle,
  paddleWebhookSecret,
  paddlePriceIds,
  PaddleConfigError,
} from "@/lib/paddle/config";
import { mapPaddleEvent, type PaddleEventInput } from "@/lib/paddle/map-event";

export async function POST(request: NextRequest) {
  // ① 驗簽（要 raw body）
  let event;
  try {
    const signature = request.headers.get("paddle-signature") ?? "";
    const raw = await request.text();
    event = await getPaddle().webhooks.unmarshal(raw, paddleWebhookSecret(), signature);
  } catch (e) {
    if (e instanceof PaddleConfigError) {
      return NextResponse.json({ error: "billing not configured" }, { status: 503 });
    }
    console.error("[paddle-webhook] signature verify failed:", e);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // ② 冪等：PK 衝突 = 已處理過
  const inserted = await db
    .insert(webhookEvents)
    .values({
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      processedAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: webhookEvents.eventId })
    .returning({ eventId: webhookEvents.eventId });
  if (inserted.length === 0) {
    return NextResponse.json({ ok: true, skipped: "duplicate" });
  }

  // ③ 映射（transaction.* 等 no-op → 200）
  const mapped = mapPaddleEvent(event as unknown as PaddleEventInput, paddlePriceIds());
  if (!mapped) {
    return NextResponse.json({ ok: true, skipped: "no-op" });
  }

  // ④ 查無 user → log + 200（admin 以 externalSubscriptionId 人工對帳）
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, mapped.userId))
    .limit(1);
  if (!user) {
    console.error(
      `[paddle-webhook] unknown user_id=${mapped.userId} event=${event.eventId} sub=${mapped.grant.externalSubscriptionId}`,
    );
    return NextResponse.json({ ok: true, skipped: "unknown-user" });
  }

  // ⑤ 亂序防護：同 user 的 paddle 訂閱，較舊事件不覆蓋較新狀態
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, mapped.userId))
    .limit(1);
  if (existing?.source === "paddle" && existing.updatedAt > event.occurredAt) {
    return NextResponse.json({ ok: true, skipped: "stale" });
  }

  await grantAccess(mapped.userId, mapped.grant);
  return NextResponse.json({ ok: true });
}

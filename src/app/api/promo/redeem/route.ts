import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { promoCodes, promoRedemptions } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getUser } from "@/lib/get-user";
import { extendAccess, getEntitlement } from "@/lib/entitlement";

// 兌換 promo code（送免費時間那種）。web NextAuth / app Bearer 皆可（走 getUser）。
// 失敗 reason：invalid / inactive / expired / exhausted / already_redeemed。
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const raw = typeof body.code === "string" ? body.code.trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }
  const code = raw.toUpperCase();

  const [promo] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, code))
    .limit(1);

  function reject(reason: string) {
    return NextResponse.json({ error: "Invalid code", reason }, { status: 400 });
  }

  if (!promo) return reject("invalid");
  if (!promo.isActive) return reject("inactive");
  if (promo.expiresAt && Date.now() >= new Date(promo.expiresAt).getTime()) {
    return reject("expired");
  }
  if (promo.maxRedemptions !== null && promo.redeemedCount >= promo.maxRedemptions) {
    return reject("exhausted");
  }

  // 該 user 已兌換次數
  const [{ used }] = await db
    .select({ used: sql<number>`count(*)::int` })
    .from(promoRedemptions)
    .where(
      and(
        eq(promoRedemptions.codeId, promo.id),
        eq(promoRedemptions.userId, user.id),
      ),
    );
  if (used >= promo.perUserLimit) return reject("already_redeemed");

  // 兌換：紀錄 + 計次 + 延長授權
  await db.insert(promoRedemptions).values({
    id: nanoid(),
    codeId: promo.id,
    userId: user.id,
    redeemedAt: new Date().toISOString(),
  });
  await db
    .update(promoCodes)
    .set({ redeemedCount: promo.redeemedCount + 1 })
    .where(eq(promoCodes.id, promo.id));
  await extendAccess(user.id, { source: "promo", days: promo.grantDays });

  const entitlement = await getEntitlement(user.id);
  return NextResponse.json({ success: true, grantedDays: promo.grantDays, entitlement });
}

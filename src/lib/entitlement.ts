// 付費 entitlement 共用邏輯（Slice A）。provider-neutral：promo / admin /（未來）
// Paddle・iOS・藍新 都透過 grantAccess/extendAccess 寫進同一張 subscriptions。
//
// 規則：isPremium = accessUntil 為 null（永久）或 now < accessUntil。

import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const TRIAL_DAYS = 7;

export type EntitlementSource =
  | "trial"
  | "comp"
  | "promo"
  | "paddle"
  | "ios"
  | "newebpay";

export type EntitlementStatus = "trialing" | "active" | "expired";

export interface Entitlement {
  isPremium: boolean;
  status: EntitlementStatus;
  source: EntitlementSource | null;
  accessUntil: string | null;
}

const NONE: Entitlement = {
  isPremium: false,
  status: "expired",
  source: null,
  accessUntil: null,
};

function isoNow(): string {
  return new Date().toISOString();
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/** 由 source + accessUntil 推 isPremium / status。accessUntil=null → 永久。 */
export function deriveEntitlement(
  source: EntitlementSource,
  accessUntil: string | null,
): Entitlement {
  const isPremium =
    accessUntil === null || Date.now() < new Date(accessUntil).getTime();
  let status: EntitlementStatus;
  if (!isPremium) status = "expired";
  else if (source === "trial") status = "trialing";
  else status = "active";
  return { isPremium, status, source, accessUntil };
}

/**
 * 讀使用者 entitlement。無列時 lazy 建一筆試用（涵蓋任何漏接的建 user 路徑），
 * 回試用狀態。
 */
export async function getEntitlement(userId: string): Promise<Entitlement> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!row) {
    // 漏接保險：lazy 建試用。
    const accessUntil = isoDaysFromNow(TRIAL_DAYS);
    await ensureTrial(userId);
    return deriveEntitlement("trial", accessUntil);
  }
  return deriveEntitlement(row.source as EntitlementSource, row.accessUntil);
}

/** 建 user 時呼叫：若還沒有 subscriptions 列，建一筆 7 天試用。冪等。 */
export async function ensureTrial(userId: string): Promise<void> {
  await db
    .insert(subscriptions)
    .values({
      userId,
      source: "trial",
      accessUntil: isoDaysFromNow(TRIAL_DAYS),
      updatedAt: isoNow(),
    })
    .onConflictDoNothing({ target: subscriptions.userId });
}

/** 寫入授權（upsert）。金流 / admin comp / promo 共用的唯一寫入點。 */
export async function grantAccess(
  userId: string,
  opts: { source: EntitlementSource; accessUntil: string | null },
): Promise<void> {
  await db
    .insert(subscriptions)
    .values({
      userId,
      source: opts.source,
      accessUntil: opts.accessUntil,
      updatedAt: isoNow(),
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        source: opts.source,
        accessUntil: opts.accessUntil,
        updatedAt: isoNow(),
      },
    });
}

/**
 * 延長授權（promo 疊加用）：accessUntil = max(now, 現有 accessUntil) + days。
 * 若現況為永久（accessUntil=null）則維持永久。
 */
export async function extendAccess(
  userId: string,
  opts: { source: EntitlementSource; days: number },
): Promise<void> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (row && row.accessUntil === null) return; // 永久，無需延長

  const base = Math.max(
    Date.now(),
    row?.accessUntil ? new Date(row.accessUntil).getTime() : 0,
  );
  const accessUntil = new Date(base + opts.days * 86_400_000).toISOString();
  await grantAccess(userId, { source: opts.source, accessUntil });
}

/** 即時撤銷（accessUntil = now）。 */
export async function revokeAccess(userId: string): Promise<void> {
  await grantAccess(userId, { source: "comp", accessUntil: isoNow() });
}

export { NONE as NO_ENTITLEMENT };

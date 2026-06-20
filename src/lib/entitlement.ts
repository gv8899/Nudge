// 付費 entitlement 共用邏輯（Phase 1，演進自 Slice A）。provider-neutral：
// promo / admin / Apple(RevenueCat) / Paddle /（未來）藍新 都透過單一寫入點
// grantAccess 寫進同一張 subscriptions。各平台讀 hasActiveEntitlement 做硬牌。
//
// 真相模型：status 是授權狀態，但 currentPeriodEnd 過期一律覆蓋成無權
// （webhook 落後時時間勝出）。currentPeriodEnd=null → 永久。
//
// 相容：access_until 是 Slice A 舊欄位，與 current_period_end 雙寫（dev/prod
// 共用 DB、舊 code 可能仍在跑的安全網）。新邏輯讀 current_period_end。

import { db } from "@/lib/db";
import { subscriptions, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const TRIAL_DAYS = 7;

export type EntitlementSource =
  | "trial"
  | "comp"
  | "promo"
  | "manual"
  | "paddle"
  | "apple"
  | "newebpay";

export type EntitlementStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";

export type EntitlementPlan = "monthly" | "annual";

export interface Entitlement {
  /** 有無付費權限（trialing/active 且未過期）。 */
  isActive: boolean;
  /** @deprecated 向後相容別名，等同 isActive。 */
  isPremium: boolean;
  status: EntitlementStatus;
  source: EntitlementSource | null;
  plan: EntitlementPlan | null;
  /** 本期 / 授權到期；null = 永久。 */
  currentPeriodEnd: string | null;
  /** 試用到期（trialing 期間有意義）。 */
  trialEnd: string | null;
  /** @deprecated 向後相容欄位，鏡像 currentPeriodEnd。 */
  accessUntil: string | null;
}

const NONE: Entitlement = {
  isActive: false,
  isPremium: false,
  status: "expired",
  source: null,
  plan: null,
  currentPeriodEnd: null,
  trialEnd: null,
  accessUntil: null,
};

function isoNow(): string {
  return new Date().toISOString();
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

interface DerivableSubscription {
  status: EntitlementStatus;
  source: EntitlementSource | null;
  currentPeriodEnd: string | null;
  trialEnd?: string | null;
  plan?: EntitlementPlan | null;
}

/**
 * 由儲存的 subscription 推有效 entitlement。
 * 規則：currentPeriodEnd=null → 永久；否則 now < currentPeriodEnd 才算未過期。
 * 過期時即使 status 是 trialing/active 也覆蓋成 expired（時間勝出）。
 */
export function deriveEntitlement(sub: DerivableSubscription): Entitlement {
  const periodEnd = sub.currentPeriodEnd;
  const notExpired =
    periodEnd === null || Date.now() < new Date(periodEnd).getTime();
  // 四個「進行中」狀態只要未過期都有權：active/trialing 正常；past_due 是扣款
  // 失敗寬限期（仍有權）；canceled 是已排定期末取消（已付到期末）。只有 expired 無權。
  const grantsAccess =
    sub.status === "trialing" ||
    sub.status === "active" ||
    sub.status === "past_due" ||
    sub.status === "canceled";
  const isActive = grantsAccess && notExpired;
  const status: EntitlementStatus =
    grantsAccess && !notExpired ? "expired" : sub.status;

  return {
    isActive,
    isPremium: isActive,
    status,
    source: sub.source,
    plan: sub.plan ?? null,
    currentPeriodEnd: periodEnd,
    trialEnd: sub.trialEnd ?? null,
    accessUntil: periodEnd,
  };
}

/**
 * 讀使用者 entitlement。無列時 lazy 建一筆試用（涵蓋任何漏接的建 user 路徑）。
 * current_period_end 為主、access_until 為舊列 fallback。
 */
export async function getEntitlement(userId: string): Promise<Entitlement> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!row) {
    await ensureTrial(userId);
    const trialEnd = isoDaysFromNow(TRIAL_DAYS);
    return deriveEntitlement({
      status: "trialing",
      source: "trial",
      currentPeriodEnd: trialEnd,
      trialEnd,
    });
  }
  return deriveEntitlement({
    status: row.status as EntitlementStatus,
    source: row.source as EntitlementSource,
    currentPeriodEnd: row.currentPeriodEnd ?? row.accessUntil,
    trialEnd: row.trialEnd,
    plan: row.plan as EntitlementPlan | null,
  });
}

/** 硬付費牆 gate：使用者目前是否有有效授權。 */
export async function hasActiveEntitlement(userId: string): Promise<boolean> {
  return (await getEntitlement(userId)).isActive;
}

/** 該帳號是否已用過一生一次的試用。 */
export async function hasUsedTrial(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ trialStartedAt: users.trialStartedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!row?.trialStartedAt;
}

/**
 * 建 user 時呼叫：若還沒有 subscriptions 列，建一筆 7 天試用。冪等。
 * 同時標記 users.trial_started_at（試用一生一次）。
 */
export async function ensureTrial(userId: string): Promise<void> {
  const trialEnd = isoDaysFromNow(TRIAL_DAYS);
  await db
    .insert(subscriptions)
    .values({
      userId,
      status: "trialing",
      source: "trial",
      currentPeriodEnd: trialEnd,
      trialEnd,
      accessUntil: trialEnd, // 相容雙寫
      createdAt: isoNow(),
      updatedAt: isoNow(),
    })
    .onConflictDoNothing({ target: subscriptions.userId });

  // 標記試用一生一次（首次設定）。
  await db
    .update(users)
    .set({ trialStartedAt: isoNow() })
    .where(eq(users.id, userId));
}

/** grantAccess 選項；webhook 之後可帶 status/plan/external ids。 */
export interface GrantOptions {
  source: EntitlementSource;
  /** 授權到期；null = 永久。沿用 Slice A 參數名（current_period_end 同義）。 */
  accessUntil: string | null;
  /** 不帶則由 source + 到期自動推（trial→trialing、其餘→active/expired）。 */
  status?: EntitlementStatus;
  plan?: EntitlementPlan | null;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
}

function defaultStatus(
  source: EntitlementSource,
  accessUntil: string | null,
): EntitlementStatus {
  if (source === "trial") return "trialing";
  if (accessUntil === null) return "active"; // 永久
  return Date.now() < new Date(accessUntil).getTime() ? "active" : "expired";
}

/** 寫入授權（upsert）。金流 / admin / promo 共用的唯一寫入點。 */
export async function grantAccess(
  userId: string,
  opts: GrantOptions,
): Promise<void> {
  const status = opts.status ?? defaultStatus(opts.source, opts.accessUntil);
  const set = {
    status,
    source: opts.source,
    currentPeriodEnd: opts.accessUntil,
    accessUntil: opts.accessUntil, // 相容雙寫
    plan: opts.plan ?? null,
    externalCustomerId: opts.externalCustomerId ?? null,
    externalSubscriptionId: opts.externalSubscriptionId ?? null,
    cancelAtPeriodEnd: opts.cancelAtPeriodEnd ?? false,
    updatedAt: isoNow(),
  };
  await db
    .insert(subscriptions)
    .values({ userId, ...set, createdAt: isoNow() })
    .onConflictDoUpdate({ target: subscriptions.userId, set });
}

/**
 * 延長授權（promo 疊加用）：accessUntil = max(now, 現有到期) + days。
 * 若現況為永久（currentPeriodEnd=null 且 active）則維持永久。
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

  const existingEnd = row?.currentPeriodEnd ?? row?.accessUntil ?? null;
  if (row && existingEnd === null && row.status === "active") return; // 永久

  const base = Math.max(
    Date.now(),
    existingEnd ? new Date(existingEnd).getTime() : 0,
  );
  const accessUntil = new Date(base + opts.days * 86_400_000).toISOString();
  await grantAccess(userId, { source: opts.source, accessUntil });
}

/** 即時撤銷（到期 = now、status = expired）。 */
export async function revokeAccess(userId: string): Promise<void> {
  await grantAccess(userId, {
    source: "manual",
    accessUntil: isoNow(),
    status: "expired",
  });
}

export { NONE as NO_ENTITLEMENT };

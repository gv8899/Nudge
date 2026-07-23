// 純函式：Paddle webhook event → grantAccess 參數。無 I/O，可完整單測。
// 只處理 subscription.created/updated/canceled；status 走白名單、期末缺失即
// 略過（避免誤設永久權）——寧可漏一拍（Paddle 會再送 updated）也不寫壞資料。

import type { GrantOptions } from "@/lib/entitlement";
import type { PaddlePriceIds } from "./config";

export type PaddleEventInput = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  data: {
    id?: string;
    status?: string;
    customerId?: string;
    customData?: Record<string, unknown> | null;
    currentBillingPeriod?: { endsAt: string } | null;
    scheduledChange?: { action: string } | null;
    items?: Array<{ price?: { id: string } }>;
  };
};

export type MappedGrant = { userId: string; grant: GrantOptions };

const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
]);

const STATUS_MAP: Record<string, "trialing" | "active" | "past_due" | "canceled"> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
};

function planFromPriceId(
  priceId: string | undefined,
  prices: PaddlePriceIds,
): "monthly" | "annual" | undefined {
  if (!priceId) return undefined;
  if (priceId === prices.monthlyTrial || priceId === prices.monthlyNoTrial) return "monthly";
  if (priceId === prices.annualTrial || priceId === prices.annualNoTrial) return "annual";
  return undefined;
}

export function mapPaddleEvent(
  e: PaddleEventInput,
  prices: PaddlePriceIds,
): MappedGrant | null {
  if (!SUBSCRIPTION_EVENTS.has(e.eventType)) return null;

  const userId = e.data.customData?.["user_id"];
  if (typeof userId !== "string" || !userId) return null;

  const status = e.data.status ? STATUS_MAP[e.data.status] : undefined;
  if (!status) return null;

  const accessUntil = e.data.currentBillingPeriod?.endsAt;
  if (!accessUntil) return null;

  return {
    userId,
    grant: {
      source: "paddle",
      status,
      plan: planFromPriceId(e.data.items?.[0]?.price?.id, prices),
      accessUntil,
      externalCustomerId: e.data.customerId,
      externalSubscriptionId: e.data.id,
      cancelAtPeriodEnd: e.data.scheduledChange?.action === "cancel",
    },
  };
}

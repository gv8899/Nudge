import { describe, it, expect } from "vitest";
import { mapPaddleEvent, type PaddleEventInput } from "./map-event";
import type { PaddlePriceIds } from "./config";

const PRICES: PaddlePriceIds = {
  monthlyTrial: "pri_mt",
  annualTrial: "pri_at",
  monthlyNoTrial: "pri_mn",
  annualNoTrial: "pri_an",
};

const base = { eventId: "evt_1", occurredAt: "2026-07-23T00:00:00Z" };

function sub(over: Partial<PaddleEventInput["data"]> = {}, eventType = "subscription.created"): PaddleEventInput {
  return {
    ...base,
    eventType,
    data: {
      id: "sub_1",
      status: "trialing",
      customerId: "ctm_1",
      customData: { user_id: "u1" },
      currentBillingPeriod: { endsAt: "2026-07-30T00:00:00Z" },
      items: [{ price: { id: "pri_at" } }],
      ...over,
    },
  };
}

describe("mapPaddleEvent", () => {
  it("subscription.created trialing → grant trialing/annual/期末", () => {
    const m = mapPaddleEvent(sub(), PRICES)!;
    expect(m.userId).toBe("u1");
    expect(m.grant).toMatchObject({
      source: "paddle",
      status: "trialing",
      plan: "annual",
      accessUntil: "2026-07-30T00:00:00Z",
      externalCustomerId: "ctm_1",
      externalSubscriptionId: "sub_1",
      cancelAtPeriodEnd: false,
    });
  });

  it("subscription.updated active → active", () => {
    const m = mapPaddleEvent(sub({ status: "active" }, "subscription.updated"), PRICES)!;
    expect(m.grant.status).toBe("active");
  });

  it("scheduledChange cancel → cancelAtPeriodEnd true", () => {
    const m = mapPaddleEvent(sub({ scheduledChange: { action: "cancel" } }), PRICES)!;
    expect(m.grant.cancelAtPeriodEnd).toBe(true);
  });

  it("subscription.canceled → status canceled、沿用期末", () => {
    const m = mapPaddleEvent(sub({ status: "canceled" }, "subscription.canceled"), PRICES)!;
    expect(m.grant.status).toBe("canceled");
    expect(m.grant.accessUntil).toBe("2026-07-30T00:00:00Z");
  });

  it("monthly price id（無 trial 組也算）→ plan monthly", () => {
    const m = mapPaddleEvent(sub({ items: [{ price: { id: "pri_mn" } }] }), PRICES)!;
    expect(m.grant.plan).toBe("monthly");
  });

  it("past_due 映射", () => {
    expect(mapPaddleEvent(sub({ status: "past_due" }), PRICES)!.grant.status).toBe("past_due");
  });

  it("缺 user_id → null", () => {
    expect(mapPaddleEvent(sub({ customData: {} }), PRICES)).toBeNull();
  });

  it("transaction.* → null（不寫入）", () => {
    expect(
      mapPaddleEvent({ ...base, eventType: "transaction.payment_failed", data: {} }, PRICES),
    ).toBeNull();
  });

  it("未知 status（paused 等）→ null（防寫壞資料）", () => {
    expect(mapPaddleEvent(sub({ status: "paused" }), PRICES)).toBeNull();
  });

  it("缺 currentBillingPeriod → null（無期末不寫入，避免誤設永久權）", () => {
    expect(mapPaddleEvent(sub({ currentBillingPeriod: null }), PRICES)).toBeNull();
  });

  it("未知 price id → plan undefined 但仍寫入", () => {
    const m = mapPaddleEvent(sub({ items: [{ price: { id: "pri_zzz" } }] }), PRICES)!;
    expect(m.grant.plan).toBeUndefined();
    expect(m.grant.status).toBe("trialing");
  });
});

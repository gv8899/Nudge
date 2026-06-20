import { describe, it, expect } from "vitest";
import { deriveEntitlement } from "./entitlement";

const future = () => new Date(Date.now() + 86_400_000).toISOString(); // +1d
const past = () => new Date(Date.now() - 86_400_000).toISOString(); // -1d

// Phase 1 模型：status 是真相，但 currentPeriodEnd 過期一律覆蓋成無權。
describe("deriveEntitlement (Phase 1 狀態機)", () => {
  it("trialing 未到期 → 有權 + status trialing", () => {
    const e = deriveEntitlement({
      status: "trialing",
      source: "trial",
      currentPeriodEnd: future(),
    });
    expect(e.isActive).toBe(true);
    expect(e.isPremium).toBe(true); // 向後相容別名
    expect(e.status).toBe("trialing");
  });

  it("trialing 已到期 → 無權 + status 覆蓋成 expired", () => {
    const e = deriveEntitlement({
      status: "trialing",
      source: "trial",
      currentPeriodEnd: past(),
    });
    expect(e.isActive).toBe(false);
    expect(e.status).toBe("expired");
  });

  it("active 永久（currentPeriodEnd=null）→ 有權 + active", () => {
    const e = deriveEntitlement({
      status: "active",
      source: "manual",
      currentPeriodEnd: null,
    });
    expect(e.isActive).toBe(true);
    expect(e.status).toBe("active");
  });

  it("active 未到期 → 有權", () => {
    const e = deriveEntitlement({
      status: "active",
      source: "apple",
      currentPeriodEnd: future(),
    });
    expect(e.isActive).toBe(true);
    expect(e.status).toBe("active");
  });

  it("active 已到期（webhook 落後）→ 時間勝出，無權 + expired", () => {
    const e = deriveEntitlement({
      status: "active",
      source: "apple",
      currentPeriodEnd: past(),
    });
    expect(e.isActive).toBe(false);
    expect(e.status).toBe("expired");
  });

  it("past_due 寬限期（期末未到）→ 有權，保留 past_due 狀態", () => {
    const e = deriveEntitlement({
      status: "past_due",
      source: "apple",
      currentPeriodEnd: future(),
    });
    expect(e.isActive).toBe(true);
    expect(e.status).toBe("past_due");
  });

  it("past_due 寬限結束（期末已過）→ 無權 + expired", () => {
    const e = deriveEntitlement({
      status: "past_due",
      source: "apple",
      currentPeriodEnd: past(),
    });
    expect(e.isActive).toBe(false);
    expect(e.status).toBe("expired");
  });

  it("canceled（期末未到）→ 仍有權（已付到期末），保留 canceled 狀態", () => {
    const e = deriveEntitlement({
      status: "canceled",
      source: "paddle",
      currentPeriodEnd: future(),
    });
    expect(e.isActive).toBe(true);
    expect(e.status).toBe("canceled");
  });

  it("canceled 期末已過 → 無權 + expired", () => {
    const e = deriveEntitlement({
      status: "canceled",
      source: "paddle",
      currentPeriodEnd: past(),
    });
    expect(e.isActive).toBe(false);
    expect(e.status).toBe("expired");
  });

  it("promo 授權 → active + 有權", () => {
    const e = deriveEntitlement({
      status: "active",
      source: "promo",
      currentPeriodEnd: future(),
    });
    expect(e.isActive).toBe(true);
    expect(e.source).toBe("promo");
  });

  it("accessUntil 鏡像 currentPeriodEnd（向後相容欄位）", () => {
    const end = future();
    const e = deriveEntitlement({
      status: "active",
      source: "apple",
      currentPeriodEnd: end,
    });
    expect(e.accessUntil).toBe(end);
    expect(e.currentPeriodEnd).toBe(end);
  });

  it("plan / trialEnd 透傳", () => {
    const tEnd = future();
    const e = deriveEntitlement({
      status: "trialing",
      source: "apple",
      currentPeriodEnd: tEnd,
      trialEnd: tEnd,
      plan: "annual",
    });
    expect(e.plan).toBe("annual");
    expect(e.trialEnd).toBe(tEnd);
  });
});

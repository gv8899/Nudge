import { describe, it, expect } from "vitest";
import { deriveEntitlement } from "./entitlement";

const future = () => new Date(Date.now() + 86_400_000).toISOString(); // +1d
const past = () => new Date(Date.now() - 86_400_000).toISOString(); // -1d

describe("deriveEntitlement", () => {
  it("trial 未到期 → trialing + premium", () => {
    const e = deriveEntitlement("trial", future());
    expect(e.isPremium).toBe(true);
    expect(e.status).toBe("trialing");
  });

  it("trial 已到期 → expired + 非 premium", () => {
    const e = deriveEntitlement("trial", past());
    expect(e.isPremium).toBe(false);
    expect(e.status).toBe("expired");
  });

  it("comp 永久（accessUntil=null）→ active + premium", () => {
    const e = deriveEntitlement("comp", null);
    expect(e.isPremium).toBe(true);
    expect(e.status).toBe("active");
  });

  it("promo 未到期 → active + premium（非 trialing）", () => {
    const e = deriveEntitlement("promo", future());
    expect(e.isPremium).toBe(true);
    expect(e.status).toBe("active");
  });

  it("comp 已到期（被 revoke）→ expired", () => {
    const e = deriveEntitlement("comp", past());
    expect(e.isPremium).toBe(false);
    expect(e.status).toBe("expired");
  });

  it("paddle 未到期 → active", () => {
    const e = deriveEntitlement("paddle", future());
    expect(e.status).toBe("active");
    expect(e.isPremium).toBe(true);
  });
});

import { describe, it, expect } from "vitest";

// jwt.ts 在 module load 時讀 AUTH_SECRET → 必須在 import 前設好（動態 import）。
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-for-vitest";
const { signJWT } = await import("./jwt");
const {
  issueCheckoutToken,
  verifyCheckoutToken,
  issueCheckoutCookieJWT,
  verifyCheckoutCookieJWT,
} = await import("./checkout-session");

describe("checkout OTT", () => {
  it("issue → verify 回 userId", async () => {
    const t = await issueCheckoutToken("u1");
    expect(await verifyCheckoutToken(t)).toBe("u1");
  });

  it("一般登入 JWT（無 purpose）→ null", async () => {
    const t = await signJWT({ userId: "u1", email: "a@b.c" });
    expect(await verifyCheckoutToken(t)).toBeNull();
  });

  it("purpose 不符（cookie JWT 餵 OTT 驗證）→ null", async () => {
    const t = await issueCheckoutCookieJWT("u1");
    expect(await verifyCheckoutToken(t)).toBeNull();
  });

  it("過期 → null", async () => {
    const t = await signJWT({ userId: "u1", purpose: "checkout" }, "0s");
    expect(await verifyCheckoutToken(t)).toBeNull();
  });

  it("亂字串 → null", async () => {
    expect(await verifyCheckoutToken("not-a-jwt")).toBeNull();
  });
});

describe("checkout cookie JWT", () => {
  it("issue → verify 回 userId", async () => {
    const t = await issueCheckoutCookieJWT("u2");
    expect(await verifyCheckoutCookieJWT(t)).toBe("u2");
  });

  it("OTT 餵 cookie 驗證（purpose 不符）→ null", async () => {
    const t = await issueCheckoutToken("u2");
    expect(await verifyCheckoutCookieJWT(t)).toBeNull();
  });

  it("一般登入 JWT → null", async () => {
    const t = await signJWT({ userId: "u2" });
    expect(await verifyCheckoutCookieJWT(t)).toBeNull();
  });
});

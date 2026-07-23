// Mac→web 結帳的一次性 token（OTT）手遞。
//
// 兩段式：① app 用 Bearer 換 60 秒 OTT（purpose:"checkout"）→ 開瀏覽器
// /checkout?ott=… ② 兌換頁驗 OTT 後設 30 分鐘 cookie JWT（purpose:
// "checkout-web"）→ redirect /paywall。兩種 purpose 都與登入 JWT 隔離：
// getUser 的 cookie fallback 只認 checkout-web、一般 API 的 Bearer 驗證
// 不認任何帶 purpose 的 token 也不受影響（僅多存 cookie 途徑）。
// 單次性靠 60s 短效 + 兌換即轉 cookie，不建表（YAGNI）。

import { signJWT, verifyJWT } from "./jwt";

export const CHECKOUT_COOKIE = "nudge_checkout";

const PURPOSE_OTT = "checkout";
const PURPOSE_COOKIE = "checkout-web";

export async function issueCheckoutToken(userId: string): Promise<string> {
  return signJWT({ userId, purpose: PURPOSE_OTT }, "60s");
}

async function verifyWithPurpose(token: string, purpose: string): Promise<string | null> {
  try {
    const payload = await verifyJWT(token);
    if (payload.purpose !== purpose || !payload.userId) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export async function verifyCheckoutToken(token: string): Promise<string | null> {
  return verifyWithPurpose(token, PURPOSE_OTT);
}

export async function issueCheckoutCookieJWT(userId: string): Promise<string> {
  return signJWT({ userId, purpose: PURPOSE_COOKIE }, "30m");
}

export async function verifyCheckoutCookieJWT(token: string): Promise<string | null> {
  return verifyWithPurpose(token, PURPOSE_COOKIE);
}

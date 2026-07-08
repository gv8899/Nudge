// 新帳號建立後的統一「開通」入口。原本 ensureTrial 散在 4 個 user-insert
// 點各自呼叫；收攏成單一 choke point，之後任何新帳號後續（trial、seed…）
// 只改這裡。

import { ensureTrial } from "@/lib/entitlement";
import { maybeSeedOnboarding } from "./seed-onboarding";

/**
 * 新 user row 建好後呼叫一次。ensureTrial + first-run onboarding seed。
 * 兩者皆冪等；seed 失敗不 throw（不擋登入）。
 */
export async function provisionNewUser(
  userId: string,
  ctx: { locale: string | null },
): Promise<void> {
  await ensureTrial(userId);
  await maybeSeedOnboarding(userId, ctx.locale);
}

/** 從 Accept-Language header 取第一個語言標籤（給 seed 選 locale）。 */
export function localeFromAcceptLanguage(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  if (!first) return null;
  return first.split(";")[0]?.trim() || null;
}

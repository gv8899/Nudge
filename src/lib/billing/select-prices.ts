// trial 一生一次：server 端依 users.trial_started_at 決定給哪組 Paddle price。
// 已用過 trial → 無 trial 價（結帳即刻扣款），防重領。

import type { PaddlePriceIds } from "@/lib/paddle/config";

export function selectPrices(
  hasUsedTrial: boolean,
  ids: PaddlePriceIds,
): { monthly: string; annual: string; withTrial: boolean } {
  return hasUsedTrial
    ? { monthly: ids.monthlyNoTrial, annual: ids.annualNoTrial, withTrial: false }
    : { monthly: ids.monthlyTrial, annual: ids.annualTrial, withTrial: true };
}

// Checkout 準備：回前端開 Paddle overlay 所需的一切。price 由 server 決定
// （trial 一生一次），客端不可指定 price id 以外集合。

import { NextResponse } from "next/server";
import { getUser } from "@/lib/get-user";
import { getEntitlement, hasUsedTrial } from "@/lib/entitlement";
import {
  paddleClientToken,
  paddlePriceIds,
  paddleEnv,
  PaddleConfigError,
} from "@/lib/paddle/config";
import { selectPrices } from "@/lib/billing/select-prices";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 已有付費訂閱（非 trial）→ 不給重複結帳；trial 中可提前轉正。
  const ent = await getEntitlement(user.id);
  if (ent.isActive && ent.source !== "trial") {
    return NextResponse.json({ alreadySubscribed: true });
  }

  try {
    const used = await hasUsedTrial(user.id);
    const prices = selectPrices(used, paddlePriceIds());
    return NextResponse.json({
      clientToken: paddleClientToken(),
      env: paddleEnv(),
      priceIds: { monthly: prices.monthly, annual: prices.annual },
      withTrial: prices.withTrial,
      customData: { user_id: user.id },
      email: user.email,
      alreadySubscribed: false,
    });
  } catch (e) {
    if (e instanceof PaddleConfigError) {
      return NextResponse.json({ error: "billing not configured" }, { status: 503 });
    }
    throw e;
  }
}

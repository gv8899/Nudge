// Paddle customer portal — 管理/取消/換卡/發票全交給 Paddle。只有 source=paddle
// 且有 externalCustomerId 的訂閱能開。

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import { getPaddle, PaddleConfigError } from "@/lib/paddle/config";

export async function POST() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .limit(1);
  if (!sub || sub.source !== "paddle" || !sub.externalCustomerId) {
    return NextResponse.json({ error: "no paddle subscription" }, { status: 400 });
  }

  try {
    const session = await getPaddle().customerPortalSessions.create(
      sub.externalCustomerId,
      sub.externalSubscriptionId ? [sub.externalSubscriptionId] : [],
    );
    return NextResponse.json({ url: session.urls.general.overview });
  } catch (e) {
    if (e instanceof PaddleConfigError) {
      return NextResponse.json({ error: "billing not configured" }, { status: 503 });
    }
    throw e;
  }
}

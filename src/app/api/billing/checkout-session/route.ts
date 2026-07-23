// OTT 簽發 —— **Bearer only**（app 專用）。刻意不走 getUser：web session 不需要
// OTT（已能直接進 /paywall），限縮簽發面。回瀏覽器要開的完整 URL。

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyJWT } from "@/lib/jwt";
import { issueCheckoutToken } from "@/lib/checkout-session";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let userId: string;
  try {
    const payload = await verifyJWT(authHeader.slice(7));
    // 一般登入 JWT 才可簽（帶 purpose 的特殊 token 不行）
    if (payload.purpose || !payload.userId) throw new Error("invalid token");
    userId = payload.userId;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ott = await issueCheckoutToken(userId);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://nudge.tw";
  // 兌換走 API route（middleware 排除 /api → 不會被 locale redirect 動到 query）
  return NextResponse.json({
    url: `${base}/api/billing/checkout/redeem?ott=${encodeURIComponent(ott)}`,
  });
}

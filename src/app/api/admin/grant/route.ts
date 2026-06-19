import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";
import { grantAccess, getEntitlement } from "@/lib/entitlement";

// Admin 手動開權限（comp）。body：
//   { email, forever: true }           → 永久
//   { email, days: 365 }               → now + N 天
//   { email, accessUntil: "ISO" }      → 指定到期
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let accessUntil: string | null;
  if (body.forever === true) {
    accessUntil = null;
  } else if (typeof body.days === "number" && body.days > 0) {
    accessUntil = new Date(Date.now() + body.days * 86_400_000).toISOString();
  } else if (typeof body.accessUntil === "string") {
    accessUntil = new Date(body.accessUntil).toISOString();
  } else {
    return NextResponse.json(
      { error: "need forever | days | accessUntil" },
      { status: 400 },
    );
  }

  await grantAccess(user.id, { source: "comp", accessUntil });
  const entitlement = await getEntitlement(user.id);
  return NextResponse.json({ success: true, entitlement });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";
import { revokeAccess, getEntitlement } from "@/lib/entitlement";

// Admin 收回權限（即時到期）。body { email }。
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
  await revokeAccess(user.id);
  const entitlement = await getEntitlement(user.id);
  return NextResponse.json({ success: true, entitlement });
}

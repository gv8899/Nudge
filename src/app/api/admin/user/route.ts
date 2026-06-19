import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";
import { getEntitlement } from "@/lib/entitlement";

// 查 user（by email）+ 其 entitlement。admin only。
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
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
  const entitlement = await getEntitlement(user.id);
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
    entitlement,
  });
}

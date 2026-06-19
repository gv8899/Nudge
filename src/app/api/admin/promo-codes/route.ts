import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { promoCodes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { isAdmin } from "@/lib/admin";

// Admin promo code 管理：GET 列表 / POST 建立。
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const codes = await db
    .select()
    .from(promoCodes)
    .orderBy(desc(promoCodes.createdAt));
  return NextResponse.json({ codes });
}

// body: { code, grantDays, maxRedemptions?, perUserLimit?, expiresAt? }
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const grantDays = Number(body.grantDays);
  if (!code || !Number.isFinite(grantDays) || grantDays <= 0) {
    return NextResponse.json(
      { error: "code + grantDays(>0) required" },
      { status: 400 },
    );
  }
  const maxRedemptions =
    body.maxRedemptions == null || body.maxRedemptions === ""
      ? null
      : Number(body.maxRedemptions);
  const perUserLimit =
    body.perUserLimit == null ? 1 : Number(body.perUserLimit);
  const expiresAt =
    typeof body.expiresAt === "string" && body.expiresAt
      ? new Date(body.expiresAt).toISOString()
      : null;

  try {
    await db.insert(promoCodes).values({
      id: nanoid(),
      code,
      grantDays,
      maxRedemptions,
      perUserLimit,
      redeemedCount: 0,
      expiresAt,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // code unique 衝突
    return NextResponse.json({ error: "code already exists" }, { status: 409 });
  }
  return NextResponse.json({ success: true, code });
}

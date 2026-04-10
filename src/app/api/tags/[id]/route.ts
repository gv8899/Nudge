import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, user.id)))
    .limit(1);

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.color !== undefined) updates.color = body.color;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

  if (Object.keys(updates).length > 0) {
    await db.update(tags).set(updates).where(eq(tags.id, id));
  }

  const [updated] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, user.id)))
    .limit(1);

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(tags).where(eq(tags.id, id));
  return NextResponse.json({ deleted: true });
}

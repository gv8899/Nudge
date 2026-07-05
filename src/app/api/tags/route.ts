import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { eq, asc, max } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import { nanoid } from "nanoid";
import { notifyUserDevices } from "@/lib/notify-devices";

export async function GET() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(tags)
    .where(eq(tags.userId, user.id))
    .orderBy(asc(tags.sortOrder));

  return NextResponse.json({ tags: rows });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = (body.name || "").trim();
  if (!name)
    return NextResponse.json({ error: "name required" }, { status: 400 });

  const [maxRow] = await db
    .select({ maxSort: max(tags.sortOrder) })
    .from(tags)
    .where(eq(tags.userId, user.id))
    .limit(1);
  const nextSort = (maxRow?.maxSort ?? -1) + 1;

  const tag = {
    id: nanoid(),
    userId: user.id,
    name,
    color: body.color || "chart-1",
    sortOrder: nextSort,
  };

  await db.insert(tags).values(tag);
  notifyUserDevices(user.id);
  return NextResponse.json(tag, { status: 201 });
}

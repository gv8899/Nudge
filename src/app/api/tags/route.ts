import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { eq, asc, min } from "drizzle-orm";
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

  // 新標籤排最上面（清單 asc 排序 → 取最小值再 -1）。三端建立後都重抓
  // server 清單，這裡是唯一的排序決定點。負值 OK：web 拖曳重排會把
  // sortOrder 正規化回 0..n。
  const [minRow] = await db
    .select({ minSort: min(tags.sortOrder) })
    .from(tags)
    .where(eq(tags.userId, user.id))
    .limit(1);
  const nextSort = (minRow?.minSort ?? 1) - 1;

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

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, tags, taskTags } from "@/lib/db/schema";
import { and, eq, ne, lt, desc, or, like } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import { stripHtml } from "@/lib/strip-html";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const cursor = searchParams.get("cursor") || "9999-12-31T23:59:59.999Z";
  const limit = Math.min(Number(searchParams.get("limit") || "20"), 50);

  const conditions = [
    eq(tasks.userId, user.id),
    ne(tasks.description, ""),
    ne(tasks.status, "archived"),
    lt(tasks.updatedAt, cursor),
  ];

  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(like(tasks.title, pattern), like(tasks.description, pattern))!
    );
  }

  const rows = db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.updatedAt))
    .limit(limit + 1)
    .all();

  // 過濾 description strip 後是空白的（例如 <p></p>）
  const filtered = rows.filter(
    (r) => r.description && stripHtml(r.description).length > 0
  );

  const hasMore = filtered.length > limit;
  const cards = hasMore ? filtered.slice(0, limit) : filtered;
  const nextCursor = hasMore ? cards[cards.length - 1].updatedAt : null;

  const cardsWithTags = cards.map((card) => {
    const cardTags = db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
      })
      .from(taskTags)
      .innerJoin(tags, eq(tags.id, taskTags.tagId))
      .where(eq(taskTags.taskId, card.id))
      .all();

    return { ...card, tags: cardTags };
  });

  return NextResponse.json({ cards: cardsWithTags, nextCursor });
}

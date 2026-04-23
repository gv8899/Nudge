import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, tags, taskTags } from "@/lib/db/schema";
import { and, eq, ne, lt, desc, inArray } from "drizzle-orm";
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
  const tagIds = (searchParams.get("tagIds") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const conditions = [
    eq(tasks.userId, user.id),
    ne(tasks.description, ""),
    ne(tasks.status, "archived"),
    lt(tasks.updatedAt, cursor),
  ];

  // Tag filter (AND): pre-compute the set of taskIds that have *all* the
  // requested tags. Done in JS via group-and-count rather than a chained
  // SQL JOIN so we don't fight drizzle's typing.
  let allowedTaskIds: Set<string> | null = null;
  if (tagIds.length > 0) {
    const taggedRows = await db
      .select({ taskId: taskTags.taskId, tagId: taskTags.tagId })
      .from(taskTags)
      .where(inArray(taskTags.tagId, tagIds));
    const counts = new Map<string, Set<string>>();
    for (const row of taggedRows) {
      const set = counts.get(row.taskId) ?? new Set<string>();
      set.add(row.tagId);
      counts.set(row.taskId, set);
    }
    allowedTaskIds = new Set();
    for (const [taskId, set] of counts) {
      if (set.size === tagIds.length) allowedTaskIds.add(taskId);
    }
    if (allowedTaskIds.size === 0) {
      return NextResponse.json({ cards: [], nextCursor: null });
    }
    conditions.push(inArray(tasks.id, Array.from(allowedTaskIds)));
  }

  // 搜尋時一次抓多點，改在 JS 側對 strip 後的內文做 case-insensitive 比對，
  // 避免 HTML tag 夾在字中間導致 SQL LIKE 不匹配（例 <p>你好</p><p>世界</p>）
  const fetchLimit = q ? 500 : limit + 1;

  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.updatedAt))
    .limit(fetchLimit);

  const lq = q.toLowerCase();
  const filtered = rows.filter((r) => {
    if (!r.description) return false;
    const plain = stripHtml(r.description);
    if (plain.length === 0) return false;
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(lq) || plain.toLowerCase().includes(lq)
    );
  });

  const hasMore = filtered.length > limit;
  const cards = hasMore ? filtered.slice(0, limit) : filtered;
  const nextCursor = hasMore ? cards[cards.length - 1].updatedAt : null;

  const cardsWithTags = await Promise.all(
    cards.map(async (card) => {
      const cardTags = await db
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
        })
        .from(taskTags)
        .innerJoin(tags, eq(tags.id, taskTags.tagId))
        .where(eq(taskTags.taskId, card.id));

      return { ...card, tags: cardTags };
    })
  );

  return NextResponse.json({ cards: cardsWithTags, nextCursor });
}

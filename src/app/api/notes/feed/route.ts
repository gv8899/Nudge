import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyNotes } from "@/lib/db/schema";
import { eq, and, lt, ne, desc } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") || "9999-12-31";
  const limit = Math.min(Number(searchParams.get("limit") || "10"), 50);

  const rows = db
    .select()
    .from(dailyNotes)
    .where(
      and(
        eq(dailyNotes.userId, user.id),
        lt(dailyNotes.date, cursor),
        ne(dailyNotes.content, ""),
        ne(dailyNotes.content, "<p></p>"),
      )
    )
    .orderBy(desc(dailyNotes.date))
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const notes = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? notes[notes.length - 1].date : null;

  return NextResponse.json({ notes, nextCursor });
}

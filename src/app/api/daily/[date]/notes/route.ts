import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyNotes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getUser } from "@/lib/get-user";

async function upsertNote(userId: string, date: string, content: string) {
  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(dailyNotes)
    .where(and(eq(dailyNotes.date, date), eq(dailyNotes.userId, userId)))
    .limit(1);

  if (existing) {
    await db.update(dailyNotes)
      .set({ content, createdAt: now })
      .where(eq(dailyNotes.id, existing.id));
    return NextResponse.json({ id: existing.id, content });
  } else {
    const id = nanoid();
    await db.insert(dailyNotes)
      .values({ id, userId, date, content, createdAt: now, sortOrder: 0 });
    return NextResponse.json({ id, content });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = await params;
  const [note] = await db
    .select()
    .from(dailyNotes)
    .where(and(eq(dailyNotes.date, date), eq(dailyNotes.userId, user.id)))
    .limit(1);

  return NextResponse.json({ content: note?.content || "", id: note?.id || null });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = await params;
  const body = await request.json();
  return await upsertNote(user.id, date, body.content);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = await params;
  const body = await request.json();
  return await upsertNote(user.id, date, body.content);
}

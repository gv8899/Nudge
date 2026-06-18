import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, tags, taskTags } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
    .limit(1);

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const taskTagRows = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(taskTags)
    .innerJoin(tags, eq(tags.id, taskTags.tagId))
    .where(eq(taskTags.taskId, id));

  return NextResponse.json({ ...task, tags: taskTagRows });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const now = new Date().toISOString();

  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 樂觀並行：client 帶 baseUpdatedAt（這次編輯所基於的版本）。若 server 已被
  // 別的裝置改新、且這次要改 rich-edit 欄位（title/description）→ 回 409 + 最新
  // task，讓 client 改用最新版（避免「停在舊內容的裝置覆蓋別台新編輯」）。
  // 沒帶 baseUpdatedAt → 跳過（向後相容：舊 client / 操作型 PATCH 不受影響）。
  //
  // 比對用「秒級 floor」：API 回應的時間戳已去毫秒（見 strip-ms.ts），client 拿到的
  // baseUpdatedAt 會比 DB 實際 updatedAt 少了毫秒，直接比會把「同版本」誤判成衝突。
  const editsRichField = body.title !== undefined || body.description !== undefined;
  if (body.baseUpdatedAt !== undefined && editsRichField) {
    const baseSec = Math.floor(new Date(body.baseUpdatedAt).getTime() / 1000);
    const currentSec = Math.floor(new Date(existing.updatedAt).getTime() / 1000);
    if (currentSec > baseSec) {
      const conflictTags = await db
        .select({ id: tags.id, name: tags.name, color: tags.color })
        .from(taskTags)
        .innerJoin(tags, eq(tags.id, taskTags.tagId))
        .where(eq(taskTags.taskId, id));
      return NextResponse.json(
        { error: "Conflict", ...existing, tags: conflictTags },
        { status: 409 },
      );
    }
  }

  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.remindAt !== undefined) updates.remindAt = body.remindAt;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

  await db.update(tasks).set(updates).where(eq(tasks.id, id));

  const [updated] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));
  return NextResponse.json({ success: true });
}

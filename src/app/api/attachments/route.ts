import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { taskAttachments, tasks } from "@/lib/db/schema";
import { getUser } from "@/lib/get-user";
import { sniffImageMime } from "@/lib/attachments/image-sniff";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachments/constants";

/** 0 < n ≤ 20000 的整數才收；其他當沒給。寬高只拿來預留版面，不信任。 */
function parseDimension(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 && n <= 20000 ? n : null;
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const taskId = form.get("taskId");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (typeof taskId !== "string" || !taskId) {
    return NextResponse.json({ error: "missing_task" }, { status: 400 });
  }
  // 先看 Blob.size 擋大檔，別把 50MB 先讀進記憶體再拒絕。
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
    .limit(1);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageMime(new Uint8Array(buf.subarray(0, 16)));
  if (!mime) return NextResponse.json({ error: "unsupported" }, { status: 400 });

  const row = {
    id: nanoid(),
    userId: user.id,
    taskId,
    mime,
    bytes: buf,
    size: buf.length,
    width: parseDimension(form.get("width")),
    height: parseDimension(form.get("height")),
    createdAt: new Date().toISOString(),
  };
  await db.insert(taskAttachments).values(row);

  return NextResponse.json(
    { id: row.id, mime: row.mime, size: row.size, width: row.width, height: row.height },
    { status: 201 },
  );
}

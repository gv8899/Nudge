import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/get-user";
import { deleteGrant, listGrants } from "@/lib/oauth/store";

/** 設定頁：列出已連線的 AI 服務。 */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ connections: await listGrants(user.id) });
}

/** 設定頁：中斷某個 AI 服務的連線（token 立即失效）。body: { id } */
export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const ok = await deleteGrant(user.id, body.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

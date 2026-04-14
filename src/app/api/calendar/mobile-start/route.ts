import { NextResponse } from "next/server";
import { getUser } from "@/lib/get-user";
import { signJWT } from "@/lib/jwt";

/**
 * Mobile 呼叫此 route 取得一次性 calendar-connect URL。
 * 會先用 Bearer JWT 驗證使用者，然後簽一張短效 ticket JWT，
 * 回傳一個帶 ticket 的 /api/calendar/connect 絕對網址供 mobile 開啟系統瀏覽器。
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticket = await signJWT(
    { userId: user.id, purpose: "calendar-connect" },
    "5m"
  );

  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const connectUrl = `${base}/api/calendar/connect?ticket=${encodeURIComponent(ticket)}`;

  return NextResponse.json({ url: connectUrl });
}

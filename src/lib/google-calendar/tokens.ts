import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { decrypt, encrypt } from "./crypto";
import { refreshAccessToken } from "./oauth";

/** 回傳狀態：ok / 未連結 / 需重新授權 */
export type TokenResult =
  | { status: "ok"; accessToken: string; selectedIds: string[] }
  | { status: "not_connected" }
  | { status: "reauth_required" };

const REFRESH_MARGIN_MS = 60_000; // 過期前 60s 就主動 refresh

/**
 * 取得使用者目前可用的 access_token，必要時自動 refresh 並寫回 DB.
 * refresh_token 失效時會清掉 DB 四個欄位並回傳 reauth_required.
 */
export async function getAccessToken(userId: string): Promise<TokenResult> {
  const [row] = await db
    .select({
      access: users.googleCalendarAccessToken,
      refresh: users.googleCalendarRefreshToken,
      expires: users.googleCalendarTokenExpires,
      selected: users.googleCalendarSelectedIds,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || !row.access || !row.refresh || !row.expires) {
    return { status: "not_connected" };
  }

  let accessToken: string;
  try {
    accessToken = decrypt(row.access);
  } catch {
    return { status: "reauth_required" };
  }

  const expiresAt = new Date(row.expires).getTime();
  if (expiresAt - Date.now() < REFRESH_MARGIN_MS) {
    // 需要 refresh
    let refreshToken: string;
    try {
      refreshToken = decrypt(row.refresh);
    } catch {
      return { status: "reauth_required" };
    }
    try {
      const result = await refreshAccessToken(refreshToken);
      accessToken = result.accessToken;
      await db
        .update(users)
        .set({
          googleCalendarAccessToken: encrypt(result.accessToken),
          googleCalendarTokenExpires: result.expiresAt.toISOString(),
        })
        .where(eq(users.id, userId));
    } catch (e) {
      console.error("refresh failed, clearing tokens:", e);
      await db
        .update(users)
        .set({
          googleCalendarAccessToken: null,
          googleCalendarRefreshToken: null,
          googleCalendarTokenExpires: null,
        })
        .where(eq(users.id, userId));
      return { status: "reauth_required" };
    }
  }

  let selectedIds: string[];
  try {
    selectedIds = row.selected ? JSON.parse(row.selected) : ["primary"];
  } catch {
    selectedIds = ["primary"];
  }
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
    selectedIds = ["primary"];
  }

  return { status: "ok", accessToken, selectedIds };
}

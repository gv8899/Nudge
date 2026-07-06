import { after } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { deviceTokens } from "@/lib/db/schema";
import { and, eq, isNull, lt, ne, or } from "drizzle-orm";
import { sendSilentPush } from "@/lib/apns";

// 同一 user 5 秒內多次變動只推一次（打字自動存檔會連發 PATCH，不能每發
// 都喚醒別台裝置）。手機收到 push 是「整包重抓」，漏掉中間幾發不影響
// 最終正確性，最壞另一台裝置晚 ~5 秒看到。
const THROTTLE_MS = 5_000;

/// 資料變動後通知該 user 的**其他**裝置背景刷新（APNs silent push）。
///
/// - **排除發起這次 mutation 的裝置**（app 帶 `X-Nudge-Device-Id` = 自己的
///   APNs token）：改東西的那台已經樂觀更新、有最新內容，不該再被自己的
///   推播喚醒去刷新 —— 否則會跟編輯器的「樂觀並行 / 409 重載」打架，變成
///   打字時每次存檔都刷新、編輯器跳回頂端（見 CardVersionStore）。
/// - 用 next/server 的 `after()` 排在回應送出後才跑，不拖慢 mutation API。
/// - 節流用 DB 原子 claim（UPDATE ... WHERE last_pushed_at 過期 RETURNING）：
///   serverless 多實例同時進來也只有一個實例搶到該裝置的推播權。
/// - 永不 throw —— 推播失敗不能弄壞資料寫入本體。
/// - 410 / BadDeviceToken 順手清掉死 token。
///
/// 在 mutation route 寫入成功後呼叫：`notifyUserDevices(user.id)`。
export function notifyUserDevices(userId: string): void {
  // headers() 在 request scope 讀（同步啟動、非同步取值），把 promise 帶進
  // after()。after() 本身跑在回應之後，這樣才穩拿到發起裝置的識別。
  const originTokenPromise = headers()
    .then((h) => h.get("x-nudge-device-id"))
    .catch(() => null);

  after(async () => {
    try {
      const originToken = await originTokenPromise;
      const now = new Date();
      const threshold = new Date(now.getTime() - THROTTLE_MS).toISOString();

      // 原子 claim：只撈「上次推播已超過節流窗」且**非發起裝置**的 token，
      // 立刻蓋新戳。ISO 字串同格式可直接字典序比較（本專案時間戳慣例）。
      const conditions = [
        eq(deviceTokens.userId, userId),
        or(
          isNull(deviceTokens.lastPushedAt),
          lt(deviceTokens.lastPushedAt, threshold)
        ),
      ];
      if (originToken) {
        conditions.push(ne(deviceTokens.token, originToken));
      }

      const claimed = await db
        .update(deviceTokens)
        .set({ lastPushedAt: now.toISOString() })
        .where(and(...conditions))
        .returning({
          id: deviceTokens.id,
          token: deviceTokens.token,
          environment: deviceTokens.environment,
        });

      if (claimed.length === 0) return;

      await Promise.all(
        claimed.map(async (device) => {
          const result = await sendSilentPush(device.token, device.environment);
          if (!result.ok && result.tokenDead) {
            await db.delete(deviceTokens).where(eq(deviceTokens.id, device.id));
            console.log(
              `[notify-devices] pruned dead token (${result.status} ${result.reason})`
            );
          }
        })
      );
    } catch (e) {
      // 推播是 best-effort：失敗只記 log，30s 輪詢會兜底。
      console.error("[notify-devices] failed:", e);
    }
  });
}

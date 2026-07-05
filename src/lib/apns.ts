import { importPKCS8, SignJWT } from "jose";
import http2 from "node:http2";

// APNs silent push（content-available:1）— 即時同步用，使用者看不到。
//
// 環境變數（.env.local / Zeabur）：
//   APNS_KEY      — .p8 私鑰內容（PEM；若以單行存放，\n 會被還原）
//   APNS_KEY_ID   — Apple 後台 Keys 頁的 Key ID
//   APNS_TEAM_ID  — Apple Developer Team ID（B9NC8LR2HQ）
//   APNS_TOPIC    — bundle id（預設 tw.nudge.app）
//
// 走 node:http2（APNs 只收 HTTP/2；undici fetch 的 h2 還是實驗性，不碰）。
// 每次送推開一條連線、送完關 —— 一個 user 頂多幾台裝置，量級用不到連線池。

const APNS_HOSTS = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
} as const;

export type ApnsEnvironment = keyof typeof APNS_HOSTS;

export type ApnsSendResult =
  | { ok: true }
  | { ok: false; status: number; reason: string; tokenDead: boolean };

// Provider token 快取：APNs 要求 JWT 存活 20 分鐘～1 小時，過期前重簽。
let cachedJWT: { value: string; issuedAt: number } | null = null;
const JWT_TTL_MS = 50 * 60 * 1000;

function apnsConfigured(): boolean {
  return Boolean(
    process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID
  );
}

async function providerJWT(): Promise<string> {
  const now = Date.now();
  if (cachedJWT && now - cachedJWT.issuedAt < JWT_TTL_MS) {
    return cachedJWT.value;
  }
  // env 常以單行存 PEM（\n 轉成字面 "\n"），還原成真換行。
  const pem = process.env.APNS_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APNS_KEY_ID! })
    .setIssuer(process.env.APNS_TEAM_ID!)
    .setIssuedAt()
    .sign(key);
  cachedJWT = { value, issuedAt: now };
  return value;
}

/// 對單一裝置 token 發 silent push。不丟例外 —— 一律回結果物件，
/// `tokenDead: true`（410 Unregistered / 400 BadDeviceToken）代表呼叫端
/// 應把該 token 從 device_tokens 清掉。
export async function sendSilentPush(
  deviceToken: string,
  environment: ApnsEnvironment
): Promise<ApnsSendResult> {
  if (!apnsConfigured()) {
    // 金鑰還沒配置（例如 dev 環境）：靜默略過，不影響 mutation。
    return { ok: false, status: 0, reason: "NotConfigured", tokenDead: false };
  }

  let jwt: string;
  try {
    jwt = await providerJWT();
  } catch (e) {
    console.error("[apns] provider JWT sign failed:", e);
    return { ok: false, status: 0, reason: "JWTSignFailed", tokenDead: false };
  }

  const topic = process.env.APNS_TOPIC ?? "tw.nudge.app";
  const body = JSON.stringify({ aps: { "content-available": 1 } });

  return new Promise((resolve) => {
    const client = http2.connect(APNS_HOSTS[environment]);
    const finish = (result: ApnsSendResult) => {
      client.close();
      resolve(result);
    };

    client.on("error", (err) => {
      console.error("[apns] http2 connect error:", err);
      finish({ ok: false, status: 0, reason: "ConnectError", tokenDead: false });
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "background",
      // silent push 規定 priority 5（10 會被 APNs 拒收 background push）。
      "apns-priority": "5",
      "content-type": "application/json",
    });

    let status = 0;
    let responseBody = "";
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    req.on("data", (chunk: Buffer) => {
      responseBody += chunk.toString();
    });
    req.on("end", () => {
      if (status === 200) {
        finish({ ok: true });
        return;
      }
      let reason = "Unknown";
      try {
        reason = JSON.parse(responseBody).reason ?? reason;
      } catch {
        // 非 JSON 回應就保持 Unknown
      }
      finish({
        ok: false,
        status,
        reason,
        // 410 = token 已註銷；BadDeviceToken = token/環境不對 —— 都該清掉。
        tokenDead: status === 410 || reason === "BadDeviceToken",
      });
    });
    req.on("error", (err) => {
      console.error("[apns] request error:", err);
      finish({ ok: false, status: 0, reason: "RequestError", tokenDead: false });
    });

    req.setTimeout(10_000, () => {
      req.close(http2.constants.NGHTTP2_CANCEL);
      finish({ ok: false, status: 0, reason: "Timeout", tokenDead: false });
    });

    req.end(body);
  });
}

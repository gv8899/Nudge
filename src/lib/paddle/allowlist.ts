// Paddle webhook 來源 IP 白名單 —— 驗簽之外的第二道防線（defense-in-depth）。
// IP 清單「不硬編碼」：由環境對應的 Paddle 端點取得並快取（清單會變動，端點才是
// source of truth）。
//   production → https://api.paddle.com/ips
//   sandbox    → https://sandbox-api.paddle.com/ips
// 回傳形狀：{ data: { ipv4_cidrs: ["34.x.x.x/32", ...] } }
//
// 失敗策略一律 fail-open（回 "skipped"）：驗簽才是主要防線，IP 端點掛掉或抓不到
// 來源 IP 時不該擋掉合法 webhook。只有「確定抓到來源 IP 且不在清單內」才 deny。

import { paddleEnv } from "./config";

const IPS_ENDPOINT: Record<"sandbox" | "production", string> = {
  production: "https://api.paddle.com/ips",
  sandbox: "https://sandbox-api.paddle.com/ips",
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 小時

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

let cache: { env: string; cidrs: string[]; fetchedAt: number } | null = null;

/** 測試用：清掉快取。 */
export function __resetAllowlistCache(): void {
  cache = null;
}

/** 取得目前環境的 Paddle IP CIDR 清單（快取 1h）。 */
export async function paddleAllowedCidrs(fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<string[]> {
  const env = paddleEnv();
  if (cache && cache.env === env && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.cidrs;
  }
  const res = await fetchImpl(IPS_ENDPOINT[env]);
  if (!res.ok) throw new Error(`paddle ips fetch failed: ${res.status}`);
  const json = (await res.json()) as { data?: { ipv4_cidrs?: string[] } };
  const cidrs = json?.data?.ipv4_cidrs ?? [];
  cache = { env, cidrs, fetchedAt: Date.now() };
  return cidrs;
}

/** 從 x-forwarded-for 取最左（原始 client）IP；反向代理會在其後 append。 */
export function clientIpFromForwarded(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  return first || null;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const o = Number(p);
    if (o > 255) return null;
    n = ((n << 8) | o) >>> 0;
  }
  return n >>> 0;
}

/** ip 是否落在 cidr（僅 IPv4）。 */
export function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = bitsStr === undefined ? 32 : Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
  return ((ipInt & mask) >>> 0) === ((rangeInt & mask) >>> 0);
}

export function ipAllowed(ip: string, cidrs: string[]): boolean {
  return cidrs.some((c) => ipInCidr(ip, c));
}

/**
 * 檢查 webhook 來源 IP。
 * - "allowed"：來源 IP 在 Paddle 清單內
 * - "denied" ：確定抓到來源 IP 但不在清單內 → 呼叫端回 403
 * - "skipped"：無法判斷（無 forwarded header / IP 端點抓失敗 / 清單空）→ 交給驗簽
 */
export async function checkPaddleSourceIp(
  forwardedFor: string | null,
  fetchImpl?: FetchLike,
): Promise<"allowed" | "denied" | "skipped"> {
  const ip = clientIpFromForwarded(forwardedFor);
  if (!ip) return "skipped";
  let cidrs: string[];
  try {
    cidrs = await paddleAllowedCidrs(fetchImpl);
  } catch (e) {
    console.warn("[paddle-webhook] ip allowlist fetch failed, skipping ip check:", e);
    return "skipped";
  }
  if (cidrs.length === 0) return "skipped";
  return ipAllowed(ip, cidrs) ? "allowed" : "denied";
}

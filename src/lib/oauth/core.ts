// MCP 連接器 OAuth 的純邏輯（無 DB / 無網路），方便單元測試。
// 規格依據：OAuth 2.1 草案 + RFC 7636 (PKCE) + RFC 8252 (loopback redirect)
// + RFC 7591 (動態註冊) + MCP authorization spec（CIMD：網址當 client_id）。

import { createHash, randomBytes } from "crypto";

/** 存進 DB 的 token / code 一律只存 SHA-256，原文只交給 client 一次。 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 不可猜的隨機字串（base64url，預設 32 bytes = 256 bit）。 */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** PKCE S256：BASE64URL(SHA256(verifier)) === challenge。只收 S256。 */
export function verifyPkce(verifier: string, challenge: string): boolean {
  // RFC 7636：verifier 43–128 字、僅 unreserved 字元
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const computed = createHash("sha256").update(verifier).digest("base64url");
  return computed === challenge;
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

/**
 * 註冊時允許的 redirect_uri：https，或 loopback 的 http（桌面 / CLI client，
 * 例如 Claude Code）。不允許 fragment。
 */
export function isAllowedRedirectUri(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:" && isLoopbackHost(u.hostname)) return true;
  return false;
}

/**
 * 授權請求的 redirect_uri 要「完全等於」註冊過的其中一個。
 * 例外（RFC 8252 §7.3）：loopback 位址的 port 可以不同（CLI 每次開隨機 port）。
 */
export function redirectUriMatches(requested: string, registered: string[]): boolean {
  if (registered.includes(requested)) return true;
  let req: URL;
  try {
    req = new URL(requested);
  } catch {
    return false;
  }
  if (req.protocol !== "http:" || !isLoopbackHost(req.hostname)) return false;
  return registered.some((r) => {
    try {
      const reg = new URL(r);
      return (
        reg.protocol === "http:" &&
        isLoopbackHost(reg.hostname) &&
        reg.hostname === req.hostname &&
        reg.pathname === req.pathname &&
        reg.search === req.search
      );
    } catch {
      return false;
    }
  });
}

/** CIMD：client_id 本身是 https 網址（且要有 path），指向 client 的 metadata JSON。 */
export function isUrlClientId(clientId: string): boolean {
  try {
    const u = new URL(clientId);
    return u.protocol === "https:" && u.pathname !== "/" && !u.hash;
  } catch {
    return false;
  }
}

export interface ClientMetadata {
  clientName: string | null;
  redirectUris: string[];
}

/**
 * 驗證 client metadata（DCR 的註冊 body，或 CIMD 抓回來的文件）。
 * 回 null = 不合法。CIMD 另外要求文件內的 client_id 等於它的網址。
 */
export function parseClientMetadata(
  raw: unknown,
  opts: { expectedClientId?: string } = {},
): ClientMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as Record<string, unknown>;
  if (opts.expectedClientId !== undefined && doc.client_id !== opts.expectedClientId) {
    return null;
  }
  const uris = doc.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 20) return null;
  if (!uris.every((u) => typeof u === "string" && isAllowedRedirectUri(u))) return null;
  const name =
    typeof doc.client_name === "string" && doc.client_name.trim()
      ? doc.client_name.trim().slice(0, 100)
      : null;
  return { clientName: name, redirectUris: uris as string[] };
}

/** 擋私有 / 保留網段，避免 CIMD 抓網址時被拿來打內網（SSRF）。 */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const m = v4.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe80")
  );
}

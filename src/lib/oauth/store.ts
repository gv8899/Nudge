// MCP 連接器 OAuth 的 DB 存取 + CIMD 抓取。純邏輯在 ./core.ts。

import { lookup } from "dns/promises";
import { and, eq, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { oauthClients, oauthCodes, oauthGrants, users } from "@/lib/db/schema";
import {
  hashToken,
  isPrivateAddress,
  isUrlClientId,
  parseClientMetadata,
  randomToken,
  type ClientMetadata,
} from "./core";

/** 授權方 / 資源的對外網址（issuer）。與 NextAuth 共用 AUTH_URL。 */
export function oauthBaseUrl(): string {
  return (process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export const MCP_RESOURCE_PATH = "/api/mcp";
export const SCOPES_SUPPORTED = ["nudge", "offline_access"];

const CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TTL_MS = 60 * 60 * 1000; // 1 小時
const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 天，每次使用就換新（滑動）

// ── Client ────────────────────────────────────────────────────────────────

export async function registerClient(meta: ClientMetadata): Promise<string> {
  const id = `nudge_${nanoid(24)}`;
  await db.insert(oauthClients).values({
    id,
    name: meta.clientName,
    redirectUris: JSON.stringify(meta.redirectUris),
    createdAt: new Date().toISOString(),
  });
  return id;
}

const cimdCache = new Map<string, { meta: ClientMetadata; at: number }>();
const CIMD_CACHE_MS = 10 * 60 * 1000;

/** 抓 CIMD 文件：只走 https、擋內網 IP、5 秒逾時、64KB 上限、不跟隨轉址。 */
async function fetchClientMetadataDocument(url: string): Promise<ClientMetadata | null> {
  const cached = cimdCache.get(url);
  if (cached && Date.now() - cached.at < CIMD_CACHE_MS) return cached.meta;
  try {
    const { hostname } = new URL(url);
    const addrs = await lookup(hostname, { all: true });
    if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) return null;
    const res = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > 64 * 1024) return null;
    const meta = parseClientMetadata(JSON.parse(text), { expectedClientId: url });
    if (meta) cimdCache.set(url, { meta, at: Date.now() });
    return meta;
  } catch {
    return null;
  }
}

/** 依 client_id 取得 client（動態註冊的查 DB；網址型的抓 CIMD 文件）。 */
export async function resolveClient(clientId: string): Promise<ClientMetadata | null> {
  if (isUrlClientId(clientId)) return fetchClientMetadataDocument(clientId);
  const [row] = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.id, clientId))
    .limit(1);
  if (!row) return null;
  try {
    return { clientName: row.name, redirectUris: JSON.parse(row.redirectUris) };
  } catch {
    return null;
  }
}

// ── Authorization code ────────────────────────────────────────────────────

export async function createAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string | null;
  resource: string | null;
}): Promise<string> {
  const code = randomToken();
  await db.insert(oauthCodes).values({
    codeHash: hashToken(code),
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    scope: input.scope,
    resource: input.resource,
    expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  return code;
}

/** 取出並刪除授權碼（一次性）。過期或不存在回 null。 */
export async function consumeAuthorizationCode(code: string) {
  const [row] = await db
    .delete(oauthCodes)
    .where(eq(oauthCodes.codeHash, hashToken(code)))
    .returning();
  if (!row) return null;
  if (row.expiresAt < new Date().toISOString()) return null;
  return row;
}

// ── Tokens / grants ───────────────────────────────────────────────────────

export interface IssuedTokens {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope?: string;
}

function newTokenPair() {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const now = Date.now();
  return {
    accessToken,
    refreshToken,
    columns: {
      accessTokenHash: hashToken(accessToken),
      accessExpiresAt: new Date(now + ACCESS_TTL_MS).toISOString(),
      refreshTokenHash: hashToken(refreshToken),
      refreshExpiresAt: new Date(now + REFRESH_TTL_MS).toISOString(),
    },
  };
}

function toResponse(pair: ReturnType<typeof newTokenPair>, scope: string | null): IssuedTokens {
  return {
    access_token: pair.accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: pair.refreshToken,
    ...(scope ? { scope } : {}),
  };
}

export async function createGrant(input: {
  userId: string;
  clientId: string;
  clientName: string | null;
  scope: string | null;
}): Promise<IssuedTokens> {
  const pair = newTokenPair();
  await db.insert(oauthGrants).values({
    id: nanoid(),
    userId: input.userId,
    clientId: input.clientId,
    clientName: input.clientName,
    scope: input.scope,
    createdAt: new Date().toISOString(),
    ...pair.columns,
  });
  return toResponse(pair, input.scope);
}

/** refresh token 輪換：舊的立即失效、換一組新的。 */
export async function rotateRefreshToken(
  refreshToken: string,
  clientId: string,
): Promise<IssuedTokens | null> {
  const nowIso = new Date().toISOString();
  const [grant] = await db
    .select()
    .from(oauthGrants)
    .where(
      and(
        eq(oauthGrants.refreshTokenHash, hashToken(refreshToken)),
        gt(oauthGrants.refreshExpiresAt, nowIso),
      ),
    )
    .limit(1);
  if (!grant || grant.clientId !== clientId) return null;
  const pair = newTokenPair();
  // 條件式 UPDATE：同一把 refresh token 併發換兩次，只有一次成功。
  const updated = await db
    .update(oauthGrants)
    .set(pair.columns)
    .where(
      and(
        eq(oauthGrants.id, grant.id),
        eq(oauthGrants.refreshTokenHash, grant.refreshTokenHash),
      ),
    )
    .returning({ id: oauthGrants.id });
  if (updated.length === 0) return null;
  return toResponse(pair, grant.scope);
}

/** 驗 access token → 回使用者。順便記錄最後使用時間（給設定頁顯示）。 */
export async function userForAccessToken(accessToken: string) {
  const nowIso = new Date().toISOString();
  const [row] = await db
    .select({ grantId: oauthGrants.id, user: users })
    .from(oauthGrants)
    .innerJoin(users, eq(users.id, oauthGrants.userId))
    .where(
      and(
        eq(oauthGrants.accessTokenHash, hashToken(accessToken)),
        gt(oauthGrants.accessExpiresAt, nowIso),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db
    .update(oauthGrants)
    .set({ lastUsedAt: nowIso })
    .where(eq(oauthGrants.id, row.grantId));
  return row.user;
}

/** RFC 7009 撤銷：access 或 refresh token 都可，命中就刪整個 grant。 */
export async function revokeToken(token: string): Promise<void> {
  const h = hashToken(token);
  await db.delete(oauthGrants).where(eq(oauthGrants.accessTokenHash, h));
  await db.delete(oauthGrants).where(eq(oauthGrants.refreshTokenHash, h));
}

// ── 設定頁：已連線的 AI 服務 ──────────────────────────────────────────────

export async function listGrants(userId: string) {
  return db
    .select({
      id: oauthGrants.id,
      clientName: oauthGrants.clientName,
      clientId: oauthGrants.clientId,
      createdAt: oauthGrants.createdAt,
      lastUsedAt: oauthGrants.lastUsedAt,
    })
    .from(oauthGrants)
    .where(eq(oauthGrants.userId, userId))
    .orderBy(oauthGrants.createdAt);
}

export async function deleteGrant(userId: string, grantId: string): Promise<boolean> {
  const rows = await db
    .delete(oauthGrants)
    .where(and(eq(oauthGrants.id, grantId), eq(oauthGrants.userId, userId)))
    .returning({ id: oauthGrants.id });
  return rows.length > 0;
}

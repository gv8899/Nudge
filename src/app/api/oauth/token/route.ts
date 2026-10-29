import { NextRequest } from "next/server";
import { verifyPkce } from "@/lib/oauth/core";
import {
  consumeAuthorizationCode,
  createGrant,
  resolveClient,
  rotateRefreshToken,
} from "@/lib/oauth/store";
import { corsPreflight, json } from "@/lib/oauth/metadata";

function oauthError(error: string, description?: string, status = 400) {
  return json({ error, ...(description ? { error_description: description } : {}) }, status);
}

/** token endpoint：authorization_code（+PKCE）換 token、refresh_token 輪換。 */
export async function POST(request: NextRequest) {
  // OAuth 規定 form-urlencoded；也容忍 JSON。
  let params: URLSearchParams;
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      params = new URLSearchParams(
        Object.entries(body).map(([k, v]) => [k, String(v)]),
      );
    } else {
      params = new URLSearchParams(await request.text());
    }
  } catch {
    return oauthError("invalid_request");
  }

  // public client 也可能用 Basic 帶 client_id（secret 為空）。
  let clientId = params.get("client_id");
  const basic = request.headers.get("authorization");
  if (!clientId && basic?.startsWith("Basic ")) {
    clientId = decodeURIComponent(
      Buffer.from(basic.slice(6), "base64").toString().split(":")[0] || "",
    );
  }
  if (!clientId) return oauthError("invalid_client", "client_id required", 401);

  const grantType = params.get("grant_type");

  if (grantType === "authorization_code") {
    const code = params.get("code");
    const verifier = params.get("code_verifier");
    const redirectUri = params.get("redirect_uri");
    if (!code || !verifier) return oauthError("invalid_request", "code and code_verifier required");
    const row = await consumeAuthorizationCode(code);
    if (!row) return oauthError("invalid_grant", "code invalid or expired");
    if (row.clientId !== clientId) return oauthError("invalid_grant", "client mismatch");
    if (redirectUri && redirectUri !== row.redirectUri) {
      return oauthError("invalid_grant", "redirect_uri mismatch");
    }
    if (!verifyPkce(verifier, row.codeChallenge)) {
      return oauthError("invalid_grant", "PKCE verification failed");
    }
    const client = await resolveClient(clientId);
    const tokens = await createGrant({
      userId: row.userId,
      clientId,
      clientName: client?.clientName ?? null,
      scope: row.scope,
    });
    return json(tokens);
  }

  if (grantType === "refresh_token") {
    const refreshToken = params.get("refresh_token");
    if (!refreshToken) return oauthError("invalid_request", "refresh_token required");
    const tokens = await rotateRefreshToken(refreshToken, clientId);
    if (!tokens) return oauthError("invalid_grant", "refresh token invalid or expired");
    return json(tokens);
  }

  return oauthError("unsupported_grant_type");
}

export function OPTIONS() {
  return corsPreflight();
}

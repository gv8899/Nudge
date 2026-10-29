// OAuth / MCP discovery 文件（RFC 8414 授權方 metadata + RFC 9728 資源 metadata）。

import { NextResponse } from "next/server";
import { MCP_RESOURCE_PATH, SCOPES_SUPPORTED, oauthBaseUrl } from "./store";

/** discovery / token / register 都是 server-to-server 或公開文件，開放 CORS（不帶 cookie）。 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version",
};

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store", ...extra },
  });
}

export function mcpResourceUrl(): string {
  return `${oauthBaseUrl()}${MCP_RESOURCE_PATH}`;
}

export function protectedResourceMetadataUrl(): string {
  return `${oauthBaseUrl()}/.well-known/oauth-protected-resource${MCP_RESOURCE_PATH}`;
}

export function authorizationServerMetadata() {
  const base = oauthBaseUrl();
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: SCOPES_SUPPORTED,
    client_id_metadata_document_supported: true,
  };
}

export function protectedResourceMetadata() {
  return {
    resource: mcpResourceUrl(),
    authorization_servers: [oauthBaseUrl()],
    scopes_supported: SCOPES_SUPPORTED,
    bearer_methods_supported: ["header"],
    resource_name: "Nudge",
  };
}

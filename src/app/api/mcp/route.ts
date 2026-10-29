import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { userForAccessToken } from "@/lib/oauth/store";
import { CORS_HEADERS, corsPreflight, protectedResourceMetadataUrl } from "@/lib/oauth/metadata";
import { mcpUserContext } from "@/lib/mcp/context";
import { createNudgeMcpServer } from "@/lib/mcp/server";

/**
 * Nudge MCP 連接器端點（Streamable HTTP、無狀態：每個請求建一個 server）。
 * 驗證：OAuth access token（Bearer）。沒帶或失效 → 401 + WWW-Authenticate，
 * 指向 resource metadata，AI 服務據此走 OAuth 授權流程。
 */
export const runtime = "nodejs";

function unauthorized(error?: "invalid_token") {
  const params = [`resource_metadata="${protectedResourceMetadataUrl()}"`];
  if (error) params.push(`error="${error}"`);
  return new Response(JSON.stringify({ error: error ?? "unauthorized" }), {
    status: 401,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer ${params.join(", ")}`,
      "Access-Control-Expose-Headers": "WWW-Authenticate",
    },
  });
}

async function handle(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return unauthorized();
  const user = await userForAccessToken(auth.slice(7).trim());
  if (!user) return unauthorized("invalid_token");

  return mcpUserContext.run(user, async () => {
    const server = createNudgeMcpServer(user);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      const res = await transport.handleRequest(request);
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
      return new Response(res.body, { status: res.status, headers });
    } finally {
      // JSON 回應模式下 handleRequest 回來時已完成；關掉釋放資源。
      void server.close();
    }
  });
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;

export function OPTIONS() {
  return corsPreflight();
}

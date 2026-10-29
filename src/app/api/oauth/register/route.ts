import { NextRequest } from "next/server";
import { parseClientMetadata } from "@/lib/oauth/core";
import { registerClient } from "@/lib/oauth/store";
import { corsPreflight, json } from "@/lib/oauth/metadata";

/** RFC 7591 動態註冊：AI 服務第一次連 Nudge 時自己註冊成 public client。 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_client_metadata" }, 400);
  }
  const meta = parseClientMetadata(body);
  if (!meta) {
    return json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris must be https or loopback http" },
      400,
    );
  }
  const clientId = await registerClient(meta);
  return json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: meta.clientName ?? undefined,
      redirect_uris: meta.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201,
  );
}

export function OPTIONS() {
  return corsPreflight();
}

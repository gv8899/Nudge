import { NextRequest } from "next/server";
import { revokeToken } from "@/lib/oauth/store";
import { corsPreflight, json } from "@/lib/oauth/metadata";

/** RFC 7009：撤銷 token。不論 token 是否存在都回 200（規格要求）。 */
export async function POST(request: NextRequest) {
  try {
    const params = new URLSearchParams(await request.text());
    const token = params.get("token");
    if (token) await revokeToken(token);
  } catch {
    // 忽略：規格要求無效 token 也回 200
  }
  return json({});
}

export function OPTIONS() {
  return corsPreflight();
}

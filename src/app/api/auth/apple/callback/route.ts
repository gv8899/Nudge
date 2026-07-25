/** Mac Sign in with Apple 中繼 — 第二段（Apple form_post 目的地）。
 *  驗 state → code 換 token → 驗 id_token 簽章與 nonce → resolveAppleUser
 *  併號 → 簽 app JWT → redirect nudge://auth/apple#token=…（fragment 不進
 *  server log）。錯誤一律 #error=<code>，殼層負責顯示；取消靜默。 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAppleIdToken } from "@/lib/auth/apple-jwt";
import { resolveAppleUser, dbAppleAccountDeps } from "@/lib/auth/apple-account";
import { signJWT } from "@/lib/jwt";

function toApp(fragment: string): NextResponse {
  // 303: POST → GET redirect。nudge:// 是合法絕對 URL，ASWebAuthenticationSession
  // 以 callbackURLScheme "nudge" 收下後關閉視窗。
  return NextResponse.redirect(`nudge://auth/apple${fragment}`, 303);
}

export async function POST(request: NextRequest) {
  const clientId = process.env.AUTH_APPLE_ID;
  const clientSecret = process.env.AUTH_APPLE_SECRET;
  if (!clientId || !clientSecret) return toApp("#error=not_configured");

  const form = await request.formData();

  if (form.get("error") === "user_cancelled_authorize") {
    return toApp("#error=cancelled");
  }

  const code = form.get("code");
  const state = form.get("state");
  const cookieState = request.cookies.get("apple_auth_state")?.value;
  const cookieNonce = request.cookies.get("apple_auth_nonce")?.value;
  if (
    typeof code !== "string" || !code ||
    typeof state !== "string" || !state ||
    !cookieState || state !== cookieState
  ) {
    return toApp("#error=invalid");
  }

  // code 換 token（client secret 與 NextAuth Apple provider 同一把）
  const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${process.env.AUTH_URL}/api/auth/apple/callback`,
    }),
  });
  if (!tokenRes.ok) {
    console.error("[apple/callback] token exchange failed:", tokenRes.status);
    return toApp("#error=token_exchange");
  }
  const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string };
  if (!idToken) return toApp("#error=token_exchange");

  let verified: Awaited<ReturnType<typeof verifyAppleIdToken>>;
  try {
    verified = await verifyAppleIdToken(idToken, clientId);
  } catch {
    return toApp("#error=invalid");
  }
  if (!cookieNonce || verified.nonce !== cookieNonce) {
    return toApp("#error=invalid");
  }

  // 首次授權 Apple 會在 form 帶 user JSON（name.firstName/lastName）
  let name: string | null = null;
  const userField = form.get("user");
  if (typeof userField === "string") {
    try {
      const parsed = JSON.parse(userField) as {
        name?: { firstName?: string; lastName?: string };
      };
      const combined = [parsed.name?.firstName, parsed.name?.lastName]
        .filter(Boolean)
        .join(" ");
      name = combined || null;
    } catch {}
  }

  const user = await resolveAppleUser(dbAppleAccountDeps, {
    sub: verified.sub,
    email: verified.email,
    name,
    locale: request.cookies.get("apple_auth_locale")?.value ?? null,
  });

  const token = await signJWT({ userId: user.id, email: user.email });
  const res = toApp(`#token=${token}`);
  res.cookies.delete("apple_auth_state");
  res.cookies.delete("apple_auth_nonce");
  res.cookies.delete("apple_auth_locale");
  return res;
}

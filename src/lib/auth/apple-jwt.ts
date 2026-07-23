/** Apple identityToken / id_token 驗簽 — JWKS 由 jose 內建快取。 */
import { createRemoteJWKSet, jwtVerify } from "jose";

const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

export async function verifyAppleIdToken(
  idToken: string,
  audience: string | string[]
): Promise<{ sub: string; email?: string; nonce?: string }> {
  const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
    issuer: "https://appleid.apple.com",
    audience,
  });
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("no subject in Apple token");
  }
  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    nonce: typeof payload.nonce === "string" ? payload.nonce : undefined,
  };
}

import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

export interface JWTPayload {
  userId: string;
  email?: string;
  /** 可選用途標記，例如 "calendar-connect" 一次性 ticket */
  purpose?: string;
}

export async function signJWT(
  payload: JWTPayload,
  expiresIn: string = "30d"
): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(secret);
}

export async function verifyJWT(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JWTPayload;
}

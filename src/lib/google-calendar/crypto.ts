import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended

function getKey(): Buffer {
  const raw = process.env.CALENDAR_TOKEN_KEY;
  if (!raw) {
    throw new Error("CALENDAR_TOKEN_KEY env var is required");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `CALENDAR_TOKEN_KEY must be 32 bytes (base64); got ${key.length}`
    );
  }
  return key;
}

/**
 * 加密明文，輸出格式 "iv.tag.ciphertext"（全部 base64）.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

/**
 * 解密 encrypt 產生的字串，失敗會拋 Error.
 */
export function decrypt(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString("utf8");
}

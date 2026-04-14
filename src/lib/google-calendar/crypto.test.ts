import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { encrypt, decrypt } from "./crypto";

beforeAll(() => {
  // 32-byte key, base64
  process.env.CALENDAR_TOKEN_KEY = randomBytes(32).toString("base64");
});

describe("calendar token crypto", () => {
  it("encrypt then decrypt returns original plaintext", () => {
    const plaintext = "ya29.a0AfH6SMB-fake-token";
    const stored = encrypt(plaintext);
    expect(stored).not.toBe(plaintext);
    expect(stored).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
    expect(decrypt(stored)).toBe(plaintext);
  });

  it("different encryptions of same input produce different ciphertexts (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("decrypt throws on tampered ciphertext", () => {
    const stored = encrypt("original");
    const [iv, tag, ct] = stored.split(".");
    const tampered = `${iv}.${tag}.${ct.slice(0, -4)}AAAA`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("decrypt throws on wrong format", () => {
    expect(() => decrypt("not-a-valid-token")).toThrow();
  });
});

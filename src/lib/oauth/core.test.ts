import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import {
  verifyPkce,
  isAllowedRedirectUri,
  redirectUriMatches,
  isUrlClientId,
  parseClientMetadata,
  isPrivateAddress,
  hashToken,
  randomToken,
} from "./core";

const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = createHash("sha256").update(verifier).digest("base64url");

describe("verifyPkce", () => {
  it("accepts matching S256 verifier", () => {
    expect(verifyPkce(verifier, challenge)).toBe(true);
  });
  it("rejects wrong verifier", () => {
    expect(verifyPkce(verifier.replace("d", "e"), challenge)).toBe(false);
  });
  it("rejects too-short verifier", () => {
    expect(verifyPkce("abc", createHash("sha256").update("abc").digest("base64url"))).toBe(false);
  });
});

describe("isAllowedRedirectUri", () => {
  it("allows https", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
  });
  it("allows loopback http", () => {
    expect(isAllowedRedirectUri("http://localhost:33418/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1/callback")).toBe(true);
  });
  it("rejects non-loopback http, custom schemes, fragments, garbage", () => {
    expect(isAllowedRedirectUri("http://evil.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isAllowedRedirectUri("https://a.com/cb#x")).toBe(false);
    expect(isAllowedRedirectUri("not a url")).toBe(false);
  });
});

describe("redirectUriMatches", () => {
  it("exact match", () => {
    expect(redirectUriMatches("https://a.com/cb", ["https://a.com/cb"])).toBe(true);
    expect(redirectUriMatches("https://a.com/cb2", ["https://a.com/cb"])).toBe(false);
  });
  it("loopback port may differ", () => {
    expect(redirectUriMatches("http://localhost:5555/callback", ["http://localhost/callback"])).toBe(true);
    expect(redirectUriMatches("http://localhost:5555/other", ["http://localhost/callback"])).toBe(false);
  });
  it("https port may not differ", () => {
    expect(redirectUriMatches("https://a.com:8443/cb", ["https://a.com/cb"])).toBe(false);
  });
});

describe("isUrlClientId", () => {
  it("https url with path", () => {
    expect(isUrlClientId("https://claude.ai/oauth/claude-code-client-metadata")).toBe(true);
  });
  it("rejects plain ids, http, bare origin", () => {
    expect(isUrlClientId("abc123")).toBe(false);
    expect(isUrlClientId("http://a.com/meta")).toBe(false);
    expect(isUrlClientId("https://a.com/")).toBe(false);
  });
});

describe("parseClientMetadata", () => {
  it("parses valid DCR body", () => {
    expect(
      parseClientMetadata({ client_name: " Claude ", redirect_uris: ["https://claude.ai/cb"] }),
    ).toEqual({ clientName: "Claude", redirectUris: ["https://claude.ai/cb"] });
  });
  it("rejects missing / bad redirect uris", () => {
    expect(parseClientMetadata({ client_name: "x" })).toBeNull();
    expect(parseClientMetadata({ redirect_uris: ["http://evil.com/cb"] })).toBeNull();
  });
  it("CIMD requires client_id to equal document url", () => {
    const doc = { client_id: "https://a.com/meta", redirect_uris: ["https://a.com/cb"] };
    expect(parseClientMetadata(doc, { expectedClientId: "https://a.com/meta" })).not.toBeNull();
    expect(parseClientMetadata(doc, { expectedClientId: "https://b.com/meta" })).toBeNull();
  });
});

describe("isPrivateAddress", () => {
  it("flags private / loopback / link-local", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "172.20.1.1", "192.168.1.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });
  it("passes public", () => {
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("2606:4700::1111")).toBe(false);
  });
});

describe("tokens", () => {
  it("random tokens are unique and hash is stable hex", () => {
    const a = randomToken();
    expect(a).not.toBe(randomToken());
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).toBe(hashToken(a));
  });
});

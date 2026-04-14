import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildAuthUrl, exchangeCode, refreshAccessToken } from "./oauth";

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_CALENDAR_REDIRECT_URI = "http://localhost:3000/api/calendar/callback";
  vi.restoreAllMocks();
});

describe("buildAuthUrl", () => {
  it("contains all required params", () => {
    const url = buildAuthUrl("state-abc");
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fcalendar%2Fcallback");
    expect(url).toContain("scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
    expect(url).toContain("state=state-abc");
    expect(url).toContain("response_type=code");
  });
});

describe("exchangeCode", () => {
  it("calls google token endpoint and returns tokens", async () => {
    const mockResponse = {
      access_token: "at-1",
      refresh_token: "rt-1",
      expires_in: 3600,
      token_type: "Bearer",
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );
    const result = await exchangeCode("auth-code-xyz");
    expect(result.accessToken).toBe("at-1");
    expect(result.refreshToken).toBe("rt-1");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws on non-200 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
    );
    await expect(exchangeCode("bad-code")).rejects.toThrow(/invalid_grant/);
  });
});

describe("refreshAccessToken", () => {
  it("returns new access_token and expires", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "at-new", expires_in: 3600, token_type: "Bearer" }),
        { status: 200 }
      )
    );
    const result = await refreshAccessToken("rt-existing");
    expect(result.accessToken).toBe("at-new");
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it("throws on 400 invalid_grant", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
    );
    await expect(refreshAccessToken("rt-bad")).rejects.toThrow(/invalid_grant/);
  });
});

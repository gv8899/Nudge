const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly " +
  "https://www.googleapis.com/auth/directory.readonly";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is required`);
  return v;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: envOrThrow("AUTH_GOOGLE_ID"),
    redirect_uri: envOrThrow("GOOGLE_CALENDAR_REDIRECT_URI"),
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface ExchangeResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export async function exchangeCode(code: string): Promise<ExchangeResult> {
  const body = new URLSearchParams({
    code,
    client_id: envOrThrow("AUTH_GOOGLE_ID"),
    client_secret: envOrThrow("AUTH_GOOGLE_SECRET"),
    redirect_uri: envOrThrow("GOOGLE_CALENDAR_REDIRECT_URI"),
    grant_type: "authorization_code",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Google OAuth exchange failed: ${json.error || res.status}`);
  }
  if (!json.refresh_token) {
    throw new Error("No refresh_token returned; did you set access_type=offline and prompt=consent?");
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
  };
}

export interface RefreshResult {
  accessToken: string;
  expiresAt: Date;
}

export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: envOrThrow("AUTH_GOOGLE_ID"),
    client_secret: envOrThrow("AUTH_GOOGLE_SECRET"),
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Google OAuth refresh failed: ${json.error || res.status}`);
  }

  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
  };
}

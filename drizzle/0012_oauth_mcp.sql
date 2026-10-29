-- drizzle/0012_oauth_mcp.sql
-- MCP 連接器 OAuth（Nudge 當授權方）。純新增三張表、不動舊欄位 →
-- dev/prod 共用 DB 可直接跑，先跑 migration 或先上 code 都安全。
--
-- Apply manually with:
--   psql "$DATABASE_URL" -f drizzle/0012_oauth_mcp.sql
CREATE TABLE IF NOT EXISTS "oauth_clients" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "redirect_uris" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "oauth_codes" (
  "code_hash" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "redirect_uri" text NOT NULL,
  "code_challenge" text NOT NULL,
  "scope" text,
  "resource" text,
  "expires_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "oauth_grants" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "client_id" text NOT NULL,
  "client_name" text,
  "scope" text,
  "access_token_hash" text NOT NULL UNIQUE,
  "access_expires_at" text NOT NULL,
  "refresh_token_hash" text NOT NULL UNIQUE,
  "refresh_expires_at" text NOT NULL,
  "created_at" text NOT NULL,
  "last_used_at" text
);

CREATE INDEX IF NOT EXISTS "oauth_grants_user_idx" ON "oauth_grants" ("user_id");

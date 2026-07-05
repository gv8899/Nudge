-- APNs 裝置 token（即時同步 silent push，iOS 首刀）。
--
-- 純新增一張表：不動既有表，dev/prod 共用 DB 下先跑 migration 或先上 code
-- 都安全（新 code 沒表會在 /api/devices 噴錯，但那是新 endpoint、舊 app
-- 不會打；保險起見仍建議先跑 migration 再上 code）。
--
-- 跑法：psql "$DATABASE_URL" -f drizzle/0008_device_tokens.sql

CREATE TABLE IF NOT EXISTS "device_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "platform" text NOT NULL,
  "environment" text NOT NULL DEFAULT 'production',
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "last_pushed_at" text
);

CREATE UNIQUE INDEX IF NOT EXISTS "device_tokens_token_uniq" ON "device_tokens" ("token");

-- notifyUserDevices 依 user_id 撈裝置，補查詢索引。
CREATE INDEX IF NOT EXISTS "device_tokens_user_id_idx" ON "device_tokens" ("user_id");

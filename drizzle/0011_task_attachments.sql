-- drizzle/0011_task_attachments.sql
-- 卡片內文圖片本體。內文 HTML 只放 `<img src="/api/attachments/<id>">`，
-- 這張表存 bytes。純新增、不動舊欄位 → dev/prod 共用 DB 可直接跑，
-- 先跑 migration 或先上 code 都安全。
--
-- Apply manually with:
--   psql "$DATABASE_URL" -f drizzle/0011_task_attachments.sql

CREATE TABLE IF NOT EXISTS "task_attachments" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "task_id" text REFERENCES "tasks"("id") ON DELETE SET NULL,
  "mime" text NOT NULL,
  "bytes" bytea NOT NULL,
  "size" integer NOT NULL,
  "width" integer,
  "height" integer,
  "created_at" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "task_attachments_user_id_idx" ON "task_attachments" ("user_id");
CREATE INDEX IF NOT EXISTS "task_attachments_task_id_idx" ON "task_attachments" ("task_id");

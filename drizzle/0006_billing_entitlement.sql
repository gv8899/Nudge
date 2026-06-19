-- 付費 entitlement Slice A：subscriptions / promo_codes / promo_redemptions。
-- provider-neutral；nullable / 新表 → 對舊 code 安全。依部署鐵則：先上會讀寫
-- 這些表的 code，再/同時跑此 migration。dev/prod 同庫，跑前確認。

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "user_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "access_until" text,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id" text PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "grant_days" integer NOT NULL,
  "max_redemptions" integer,
  "per_user_limit" integer NOT NULL DEFAULT 1,
  "redeemed_count" integer NOT NULL DEFAULT 0,
  "expires_at" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "promo_redemptions" (
  "id" text PRIMARY KEY,
  "code_id" text NOT NULL REFERENCES "promo_codes"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "redeemed_at" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "promo_redemptions_code_id_idx" ON "promo_redemptions" ("code_id");
CREATE INDEX IF NOT EXISTS "promo_redemptions_user_id_idx" ON "promo_redemptions" ("user_id");

-- backfill：既有 user 給「now + 7 天」試用（soft 模式不鎖人，無害）。
INSERT INTO "subscriptions" ("user_id", "source", "access_until", "updated_at")
SELECT u."id", 'trial',
       to_char((now() + interval '7 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM "users" u
LEFT JOIN "subscriptions" s ON s."user_id" = u."id"
WHERE s."user_id" IS NULL;

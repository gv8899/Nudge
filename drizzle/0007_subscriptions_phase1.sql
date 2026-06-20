-- 付費 entitlement Phase 1：subscriptions 演進成肥模型 + users.trial_started_at。
--
-- 鐵則（dev/prod 共用同一個 Postgres，prod 可能仍跑 Slice A 舊 code）：
--   * 純 additive：只加 nullable / 有 default 的欄位，**不 rename、不 drop**。
--   * 保留 access_until（Slice A 舊欄位），新 code 與 current_period_end 雙寫，
--     舊 code 繼續讀 access_until 不受影響。
--   * 先上「會寫新欄位」的 code，再/同時跑此 migration。
--
-- 跑法：psql "$DATABASE_URL" -f drizzle/0007_subscriptions_phase1.sql

-- 1) users：試用一生一次的綁定欄位。
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_started_at" text;

-- 2) subscriptions：新增 Phase 1 欄位（全 nullable 或帶 default）。
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'trialing';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "plan" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "current_period_end" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "trial_end" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "external_customer_id" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "external_subscription_id" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" boolean NOT NULL DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "created_at" text;

-- 3) 回填既有列。
--   current_period_end ← access_until（同義；NULL = 永久，保持 NULL）。
UPDATE "subscriptions" SET "current_period_end" = "access_until" WHERE "current_period_end" IS NULL;

--   status：trial → trialing；其餘（comp/promo/paddle…）→ 依到期判 active/expired。
--   永久（access_until IS NULL）一律 active。
UPDATE "subscriptions" SET "status" = CASE
    WHEN "source" = 'trial' THEN 'trialing'
    WHEN "access_until" IS NULL THEN 'active'
    WHEN "access_until" > to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') THEN 'active'
    ELSE 'expired'
  END;

--   trial_end：trial 列補上（= access_until）。
UPDATE "subscriptions" SET "trial_end" = "access_until" WHERE "source" = 'trial' AND "trial_end" IS NULL;

--   created_at：補成 updated_at（無更準的來源）。
UPDATE "subscriptions" SET "created_at" = "updated_at" WHERE "created_at" IS NULL;

-- 4) users.trial_started_at：既有 user 視為已用過試用（避免刪帳號重領）。
--   以 user.created_at 當試用起點 proxy。
UPDATE "users" u
SET "trial_started_at" = u."created_at"
WHERE u."trial_started_at" IS NULL
  AND EXISTS (SELECT 1 FROM "subscriptions" s WHERE s."user_id" = u."id");

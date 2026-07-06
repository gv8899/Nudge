-- Add users.onboarded_at column — first-run onboarding gate.
-- Nullable ISO string: NULL = not yet onboarded (new account will be seeded
-- with example tasks/cards at creation time). A non-null timestamp is the
-- idempotency latch (seed runs exactly once via UPDATE ... WHERE onboarded_at
-- IS NULL).
--
-- The backfill marks every EXISTING user as already-onboarded so the feature
-- never seeds accounts that predate it — only genuinely new signups get the
-- example content.
--
-- Deploy order: ship the code that reads/writes this column BEFORE running the
-- migration (column is nullable + backfilled, so old code is unaffected).
--
-- Apply manually with:
--   psql "$DATABASE_URL" -f drizzle/0009_add_users_onboarded_at.sql

ALTER TABLE "users" ADD COLUMN "onboarded_at" text;

UPDATE "users" SET "onboarded_at" = now()::text WHERE "onboarded_at" IS NULL;

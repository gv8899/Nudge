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

-- Backfill existing users with a FIXED PAST timestamp (epoch), not now(): this
-- marks them "already onboarded" (so the seed's `WHERE onboarded_at IS NULL`
-- gate never fires for them) WITHOUT making them look "recently onboarded" to
-- the frontend — the welcome card / hints only show when onboarded_at is within
-- the last 7 days. Using now() here would flash the welcome UI at every existing
-- user for a week. New signups get a real now() timestamp from the seed writer.
UPDATE "users" SET "onboarded_at" = '1970-01-01T00:00:00.000Z' WHERE "onboarded_at" IS NULL;

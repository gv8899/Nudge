-- Paddle webhook idempotency table — one row per received webhook event.
-- event_id is Paddle's globally-unique id; the webhook route inserts with
-- ON CONFLICT DO NOTHING and treats a conflict as "already processed".
-- occurred_at is kept for out-of-order protection (older events must not
-- overwrite newer subscription state).
--
-- Deploy order: ship the webhook code BEFORE running this migration is NOT
-- required (the route 503s without Paddle env anyway), but run this before
-- pointing a real Paddle webhook at /api/webhooks/paddle.
--
-- Apply manually with:
--   psql "$DATABASE_URL" -f drizzle/0010_webhook_events.sql

CREATE TABLE IF NOT EXISTS "webhook_events" (
  "event_id" text PRIMARY KEY,
  "event_type" text NOT NULL,
  "occurred_at" text NOT NULL,
  "processed_at" text NOT NULL
);

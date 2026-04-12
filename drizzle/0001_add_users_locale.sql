-- Add users.locale column for i18n preference persistence
-- Nullable: null = not set (fall back to Accept-Language header)
-- Valid values: 'zh-TW' | 'en' | 'ja'
--
-- Apply manually with:
--   psql "$DATABASE_URL" -f drizzle/0001_add_users_locale.sql
--
-- Or inside the DB shell:
--   \i drizzle/0001_add_users_locale.sql

ALTER TABLE "users" ADD COLUMN "locale" text;

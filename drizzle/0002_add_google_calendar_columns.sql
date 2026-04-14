-- Add Google Calendar integration columns to users table
-- Columns are nullable text fields for storing:
-- - googleCalendarAccessToken: encrypted OAuth access token
-- - googleCalendarRefreshToken: encrypted OAuth refresh token
-- - googleCalendarTokenExpires: ISO datetime string of token expiry
-- - googleCalendarSelectedIds: JSON array of selected calendar IDs

ALTER TABLE "users" ADD COLUMN "google_calendar_access_token" text;
ALTER TABLE "users" ADD COLUMN "google_calendar_refresh_token" text;
ALTER TABLE "users" ADD COLUMN "google_calendar_token_expires" text;
ALTER TABLE "users" ADD COLUMN "google_calendar_selected_ids" text;

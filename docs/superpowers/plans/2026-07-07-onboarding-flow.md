# Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New users get a curated set of example tasks/cards seeded into their account at signup (becoming their real data), plus a welcome card + inline hints, on Web and Apple.

**Architecture:** Seed at account-creation via a single shared `provisionNewUser()` choke point, gated idempotently by a new `users.onboarded_at` flag. Seed content is authored per-locale (zh-TW/en/ja) as pure data; a pure `buildOnboardingSeed()` builder is unit-tested and a thin Drizzle writer persists it in one transaction. Frontends read `onboardedAt` and show a welcome card + inline hints, gated on recency + local seen-flag + anchor-exists.

**Tech Stack:** Next.js (App Router, `src/`), Drizzle ORM + Postgres, next-intl, SwiftUI (`apple/`), vitest.

## Global Constraints

- Seeded example content becomes the user's **real data** — no sample flag.
- Timestamps stored as **text ISO strings**, not timestamptz. New column `onboarded_at: text` nullable.
- Migration naming `drizzle/000X_snake_name.sql`; run manually via `psql`. Additive nullable + backfill existing users to a FIXED PAST timestamp (epoch), not now() — marks them onboarded without tripping the 7-day "recent" welcome window.
- Deploy order: ship code depending on the new column **before** running the migration (nullable/backfill makes it safe).
- Only build today/past `daily_task_assignments`; recurrence `start_date = today`; never pre-materialize future assignments (orphan invariant).
- Colors from design tokens only (Web: `globals.css`/Tailwind token names; Apple: `Color.nudgeXxx`). No hardcoded hex / default palette colors.
- UI strings: edit `i18n/canonical/zh-TW.json` → `npm run i18n:sync` → mirror to `src/messages` + Apple `Localizable.xcstrings`. Seed **content** is data, not UI strings — lives in `src/lib/onboarding/content/{locale}.ts`, NOT the message catalog.
- Apple DoD: `swift build` passing ≠ done — must `xcodebuild -scheme Nudge-iOS ... build` and test in simulator.
- `IconButton` / `NudgeCheckbox` / `NudgeButton` / `NudgeModalOverlay` for Apple UI; `Text("key", bundle: .module)`.

---

## File Structure

**Backend / shared (Web `src/`):**
- `src/lib/db/schema.ts` — add `onboardedAt` to `users`.
- `drizzle/0009_add_users_onboarded_at.sql` — migration + backfill.
- `src/lib/onboarding/content/types.ts` — `OnboardingContent` type (locale-neutral shape).
- `src/lib/onboarding/content/zh-TW.ts`, `en.ts`, `ja.ts` — per-locale content data.
- `src/lib/onboarding/content/index.ts` — `contentForLocale(locale)` with zh-TW fallback.
- `src/lib/onboarding/build-seed.ts` — pure `buildOnboardingSeed(content, now, tz) -> SeedPlan` + `SeedPlan` type.
- `src/lib/onboarding/build-seed.test.ts` — unit tests (pure).
- `src/lib/onboarding/seed-onboarding.ts` — `maybeSeedOnboarding(userId, locale)` (gate + tx + Drizzle writes).
- `src/lib/onboarding/provision-user.ts` — `provisionNewUser(userId, ctx)` = ensureTrial + maybeSeedOnboarding.
- `src/lib/auth.ts:29`, `src/app/api/auth/apple/route.ts:99`, `src/app/api/auth/mobile/route.ts:56` — call `provisionNewUser`.
- `src/app/api/me/route.ts` — include `onboardedAt` in response.

**Web frontend:**
- `src/components/onboarding/welcome-card.tsx` — dismissible welcome card.
- `src/components/onboarding/onboarding-hints.tsx` — inline hint bubbles + gating hook.
- `src/hooks/use-onboarding.ts` — recency + localStorage seen-flag logic.
- `src/components/daily/daily-view.tsx` — mount welcome card + hints.
- `i18n/canonical/zh-TW.json` — onboarding UI strings.

**Apple:**
- Me-endpoint model (wherever `/api/me` is decoded) — add `onboardedAt`.
- `apple/NudgeKit/Sources/NudgeUI/Onboarding/OnboardingWelcomeView.swift` — welcome (via NudgeModalOverlay).
- `apple/NudgeKit/Sources/NudgeUI/Onboarding/OnboardingHints.swift` — inline hints + gating.
- `apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift` — mount.
- `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings` — mirrored keys.

---

## Task 1: DB column + migration

**Files:** Modify `src/lib/db/schema.ts` (users table); Create `drizzle/0009_add_users_onboarded_at.sql`.

- [ ] Add `onboardedAt: text("onboarded_at")` to `users` in `schema.ts` (after `trialStartedAt`).
- [ ] Write migration:
```sql
ALTER TABLE users ADD COLUMN onboarded_at text;
-- existing users are considered already-onboarded so they are never seeded;
-- fixed past timestamp (not now()) so they don't trip the frontend 7-day window
UPDATE users SET onboarded_at = '1970-01-01T00:00:00.000Z' WHERE onboarded_at IS NULL;
```
- [ ] `npx next build` (type check schema). Commit.

## Task 2: Per-locale content data

**Files:** Create `content/types.ts`, `content/zh-TW.ts`, `content/en.ts`, `content/ja.ts`, `content/index.ts`.

**Interfaces — Produces:**
```ts
type OnboardingTask = { key: string; title: string; dayOffset: number | null; done?: boolean;
  recurrence?: 'weekly_fri' | 'weekdays'; remindAtTimeOfDay?: string; tagKey?: string };
type OnboardingCard = { key: string; title: string; html: string; tagKey?: string };
type OnboardingNote = { dayOffset: number; html: string };
type OnboardingTag = { key: string; name: string; color: string };
type OnboardingContent = { tags: OnboardingTag[]; tasks: OnboardingTask[];
  cards: OnboardingCard[]; notes: OnboardingNote[] };
function contentForLocale(locale: string | null): OnboardingContent; // zh-TW fallback
```

- [ ] Port zh-TW content verbatim from `scripts/seed-landing-demo.mjs:68-168` into `zh-TW.ts` conforming to the type. Stable `key`s per item (used by frontend anchors + content-parity test).
- [ ] Author `en.ts` and `ja.ts` — same keys/structure, translated titles/HTML/notes/tag names. **Mark file-top comment: `// TODO(review): en/ja translations authored by Claude — please review`.**
- [ ] `index.ts`: map locale → content, fallback zh-TW.
- [ ] Commit.

## Task 3: Pure seed builder + tests

**Files:** Create `build-seed.ts`, `build-seed.test.ts`.

**Interfaces — Produces:** `buildOnboardingSeed(content, now: Date, tz: string): SeedPlan` where `SeedPlan` holds fully-resolved rows (task rows with computed `assignDate`/`remindAt` ISO strings, recurrence rules with `startDate`, tag rows, card rows, note rows, join rows) — pure, no DB, no I/O, no `Date.now()`/random (ids assigned by writer).

- [ ] Write failing tests: (a) counts match content; (b) `dayOffset:-3` → assignDate = today−3 in tz; (c) recurrence rule `startDate === today`; (d) no assignment with date > today; (e) weekly_fri carries `remindAtTimeOfDay`.
- [ ] Run → fail.
- [ ] Implement `buildOnboardingSeed` (tz-aware ymd via `Intl.DateTimeFormat` with timeZone; offsets from a passed-in `now`).
- [ ] Run → pass. Commit.

## Task 4: `maybeSeedOnboarding` (gate + writer)

**Files:** Create `seed-onboarding.ts`. (DB-integration; unit-tested lightly — heavy verification is the live run.)

**Interfaces — Consumes:** `buildOnboardingSeed`, `contentForLocale`. **Produces:** `async maybeSeedOnboarding(userId: string, locale: string | null): Promise<boolean>` (true if it seeded).

- [ ] Implement: in a transaction, `UPDATE users SET onboarded_at = <nowISO> WHERE id = ? AND onboarded_at IS NULL` → if 0 rows affected, return false. Else `buildOnboardingSeed(contentForLocale(locale), now, tz)` and insert all rows via Drizzle (tags, tasks, status_history, daily_task_assignments with ON CONFLICT DO NOTHING semantics, task_recurrences, task_tags, daily_notes, notification_preferences upsert). Wrap in try/catch — on error rollback (incl. gate) and return false; never throw.
- [ ] tz source: user row has no tz; use app default tz constant (document it). locale param drives content.
- [ ] `npx next build`. Commit.

## Task 5: `provisionNewUser` wired into 3 sites

**Files:** Create `provision-user.ts`; Modify `auth.ts`, `apple/route.ts`, `mobile/route.ts`.

**Interfaces — Produces:** `async provisionNewUser(userId: string, ctx: { locale: string | null }): Promise<void>` = `await ensureTrial(userId); await maybeSeedOnboarding(userId, ctx.locale);`

- [ ] Implement `provisionNewUser`.
- [ ] `auth.ts`: replace the post-insert `ensureTrial` with `provisionNewUser(newUserId, { locale: <from signIn — Accept-Language or null> })`.
- [ ] `apple/route.ts:99-100`: replace `ensureTrial` with `provisionNewUser(newUserId, { locale: req Accept-Language })`.
- [ ] `mobile/route.ts:56-57`: same.
- [ ] `npx next build`. Commit.

## Task 6: Expose `onboardedAt` in `/api/me`

**Files:** Modify `src/app/api/me/route.ts`.

- [ ] Add `onboardedAt` to the returned JSON (select the column, include in payload).
- [ ] `npx next build`. Commit.

## Task 7: Web welcome card + inline hints

**Files:** Create `use-onboarding.ts`, `welcome-card.tsx`, `onboarding-hints.tsx`; Modify `daily-view.tsx`; add UI strings to `i18n/canonical/zh-TW.json` + `npm run i18n:sync`.

- [ ] Add canonical keys under `onboarding.*` (welcome title/body/points/cta; hint.complete/hint.recurring/hint.card). Run `npm run i18n:sync` (author en/ja pending entries myself, re-sync).
- [ ] `use-onboarding.ts`: hook reading `onboardedAt` (from existing me/SWR), computes `showWelcome` = onboardedAt present && within recency window (e.g. 7 days) && `!localStorage['nudge.onboarding.welcomeSeen']`; `dismissWelcome()` sets flag. Same pattern per-hint seen keys.
- [ ] `welcome-card.tsx`: dismissible card using existing modal/overlay + tokens; on dismiss calls `dismissWelcome`.
- [ ] `onboarding-hints.tsx`: renders a hint only if gating passes AND its anchored seed item (by content `key`) is present in the day's data; each individually dismissible.
- [ ] Mount both in `daily-view.tsx`.
- [ ] `npx next build`. Manual web run. Commit.

## Task 8: Apple — model + welcome + hints

**Files:** Me-model decode site (+`onboardedAt`); Create `OnboardingWelcomeView.swift`, `OnboardingHints.swift`; Modify `DailyHostView.swift`; mirror keys into `Localizable.xcstrings`.

- [ ] Decode `onboardedAt` in the me model.
- [ ] Gating helper (UserDefaults seen-flags + recency window + anchor-exists), mirroring web.
- [ ] `OnboardingWelcomeView` via `NudgeModalOverlay`; `NudgeButton` for CTA; tokens only.
- [ ] Inline hints anchored to seeded rows in `DailyHostView` (iOS + macOS).
- [ ] Mirror `onboarding.*` keys into `Localizable.xcstrings` (`Text("key", bundle: .module)`).
- [ ] `cd apple && xcodegen generate` if new files added to project; `xcodebuild -scheme Nudge-iOS ... build`. Commit.

## Task 9: Verification pass

- [ ] `npm test` (vitest) green.
- [ ] `npm run i18n:check` clean.
- [ ] `npx next build` clean.
- [ ] `xcodebuild -scheme Nudge-iOS -destination 'generic/platform=iOS Simulator' build` clean.
- [ ] Write morning test checklist (web + iOS + macOS interactive steps) for the user.

---

## Self-Review notes

- Spec coverage: §2 data model→T1; §3 seam→T5; §4 content/builder/writer→T2-4; §5 frontend→T6-8; §6 edges (race/fail/recency/anchor)→T4+T7/T8 gating; §7 tests→T3+T9. Covered.
- Translations (en/ja) can't be user-reviewed before build (user asleep) → authored by Claude, flagged with TODO(review), listed in morning checklist.
- DB-integration tests for T4 require a test DB not confirmed present → pure logic isolated in T3 (tested); T4 verified via live run.

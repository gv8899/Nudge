-- Sign in with Apple：穩定的 Apple user id（sub）。nullable、無 default →
-- 對舊資料安全（既有 Google 使用者 apple_sub 留 NULL）。
-- 依部署鐵則：先上會讀寫 apple_sub 的 code，再/同時跑這支。
ALTER TABLE "users" ADD COLUMN "apple_sub" text;
CREATE UNIQUE INDEX IF NOT EXISTS "users_apple_sub_unique" ON "users" ("apple_sub");

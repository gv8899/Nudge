# i18n Phase 7 — Login Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 web `login/page.tsx` 和 mobile `login_screen.dart` 的字串搬到 i18n canonical（新增 top-level `login.*` namespace 3 個 key）。

**Architecture:** 節奏同 Phase 4-6：seed canonical → sync → gen-l10n → 遷移（web + mobile 合在一個 task）→ 最終驗證。Web login 是 **server component**，要用 `getTranslations` 而非 `useTranslations`。

**Tech Stack:** next-intl v4 (server component API)、Flutter gen-l10n、`AppL10n`。

**Spec：** `docs/superpowers/specs/2026-04-12-i18n-phase7-login-design.md`

---

## 檔案結構

### 修改

**Canonical：**
- `i18n/canonical/zh-TW.json` — 加 top-level `login` namespace
- `i18n/canonical/en.json`
- `i18n/canonical/ja.json`

**生成：**
- `i18n/.i18n-cache.json`
- `src/messages/{zh-TW,en,ja}.json`
- `mobile/lib/l10n/app_{zh,en,ja}.arb`
- `mobile/lib/l10n/app_localizations*.dart`

**Web：**
- `src/app/[locale]/login/page.tsx` — 2 字串 + 加 `getTranslations` import

**Mobile：**
- `mobile/lib/features/auth/login_screen.dart` — 3 字串 + 加 `AppL10n` import

---

# Task 1: Canonical login namespace + 翻譯 + sync

**Files:**
- Modify: `i18n/canonical/zh-TW.json`
- Modify: `i18n/canonical/en.json`
- Modify: `i18n/canonical/ja.json`

- [ ] **Step 1: 讀現有 zh-TW.json**

```bash
grep -n "^  \"" i18n/canonical/zh-TW.json
```
Expected: 看到 `common` / `settings` / `tags` / `nav` 四個 top-level namespaces。

- [ ] **Step 2: 加 `login` 到 zh-TW.json**

在 `nav` namespace 之後、檔案閉合 `}` 之前加：

```json
  "login": {
    "tagline": "輕量型每日任務推進工具",
    "signInWithGoogle": "使用 Google 帳號登入",
    "loginFailed": "登入失敗，請再試一次"
  }
```

- [ ] **Step 3: 跑 sync**

```bash
npm run i18n:sync
```
Expected: `📊 Diff: +3 ~0 -0`, 3 en + 3 ja pending。

- [ ] **Step 4: 加 `login` 到 en.json**

```json
  "login": {
    "tagline": "A lightweight nudge for your daily tasks",
    "signInWithGoogle": "Sign in with Google",
    "loginFailed": "Sign-in failed. Please try again."
  }
```

- [ ] **Step 5: 加 `login` 到 ja.json**

```json
  "login": {
    "tagline": "毎日のタスクをそっと後押し",
    "signInWithGoogle": "Google でサインイン",
    "loginFailed": "サインインに失敗しました。もう一度お試しください。"
  }
```

- [ ] **Step 6: 再跑 sync**

```bash
npm run i18n:sync
```
Expected: `📊 Diff: +0 ~0 -0`, removed pending, `✅ Sync 完成`。

- [ ] **Step 7: `i18n:check`**

```bash
npm run i18n:check
```
Expected: `✅ In sync`

- [ ] **Step 8: Commit**

```bash
git add i18n/ src/messages/ mobile/lib/l10n/app_zh.arb mobile/lib/l10n/app_en.arb mobile/lib/l10n/app_ja.arb
git commit -m "feat(i18n): 加 login namespace canonical 和 en/ja 翻譯"
```

---

# Task 2: 重跑 flutter gen-l10n

**Files:**
- Generated: `mobile/lib/l10n/app_localizations*.dart`

- [ ] **Step 1: gen-l10n**

```bash
cd mobile && flutter gen-l10n && cd ..
```

- [ ] **Step 2: 驗證新 getter**

```bash
grep -cE "loginTagline|loginSignInWithGoogle|loginLoginFailed" mobile/lib/l10n/app_localizations.dart
```
Expected: ≥ `3`

- [ ] **Step 3: Analyze**

```bash
cd mobile && flutter analyze lib/l10n/ && cd ..
```
Expected: `No issues found!`

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/l10n/app_localizations*.dart
git commit -m "feat(mobile): 重跑 gen-l10n 產出新 AppL10n login getter"
```

---

# Task 3: Web + Mobile login 遷移

**Files:**
- Modify: `src/app/[locale]/login/page.tsx`
- Modify: `mobile/lib/features/auth/login_screen.dart`

因為兩個檔案字串都很少，合一個 task 完成。先做 web，再做 mobile，最後一次 commit 兩個 refactor 但分開 commit message 方便追蹤。

## Web 部分

- [ ] **Step 1: 讀 `src/app/[locale]/login/page.tsx`**

```bash
wc -l src/app/\[locale\]/login/page.tsx
```
Expected: 約 55 行。

- [ ] **Step 2: 加 `getTranslations` import**

找到 line 1-2：
```tsx
import { signIn, auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
```

加一行 next-intl server import：
```tsx
import { signIn, auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
```

- [ ] **Step 3: 在 component 內取 `t`**

找到 line 4-11：
```tsx
export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (session?.user) redirect({ href: "/", locale });
```

改成：
```tsx
export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (session?.user) redirect({ href: "/", locale });

  const t = await getTranslations({ locale, namespace: "login" });
```

- [ ] **Step 4: 遷移 tagline**

找到：
```tsx
          <p className="text-text-dim">輕量型每日任務推進工具</p>
```

改成：
```tsx
          <p className="text-text-dim">{t("tagline")}</p>
```

- [ ] **Step 5: 遷移登入 button 文字**

找到：
```tsx
            使用 Google 帳號登入
```

改成：
```tsx
            {t("signInWithGoogle")}
```

- [ ] **Step 6: Build 驗證 web 部分**

```bash
npx next build 2>&1 | tail -15
```
Expected: `✓ Compiled successfully`, no TS errors.

- [ ] **Step 7: Commit web**

```bash
git add src/app/\[locale\]/login/page.tsx
git commit -m "refactor(web): login page 字串改用 getTranslations"
```

## Mobile 部分

- [ ] **Step 8: 讀 `mobile/lib/features/auth/login_screen.dart`**

- [ ] **Step 9: 加 import**

找到 line 1-3：
```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_provider.dart';
```

加一行：
```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../l10n/app_localizations.dart';
import 'auth_provider.dart';
```

- [ ] **Step 10: 在 `_handleLogin` 改錯誤 snackbar**

找到 line 15-26：
```dart
  Future<void> _handleLogin() async {
    setState(() => _isLoading = true);
    final success = await ref.read(authProvider.notifier).login();
    if (mounted) {
      setState(() => _isLoading = false);
      if (!success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('登入失敗，請再試一次')),
        );
      }
    }
  }
```

改成：
```dart
  Future<void> _handleLogin() async {
    setState(() => _isLoading = true);
    final success = await ref.read(authProvider.notifier).login();
    if (mounted) {
      setState(() => _isLoading = false);
      if (!success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppL10n.of(context)!.loginLoginFailed)),
        );
      }
    }
  }
```

注意：去掉 `const SnackBar(...)`（因為內含 runtime string）。`AppL10n.of(context)!` 直接在這取 —— `context` 是 State member、`mounted` 已檢查過。

- [ ] **Step 11: 在 `build` method 加 `l` + 遷移 tagline + button**

找到 line 28-64：
```dart
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'Nudge',
              style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              '輕量型每日任務推進工具',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey,
                  ),
            ),
            const SizedBox(height: 48),
            _isLoading
                ? const CircularProgressIndicator()
                : ElevatedButton.icon(
                    onPressed: _handleLogin,
                    icon: const Icon(Icons.login, size: 20),
                    label: const Text('使用 Google 帳號登入'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 24, vertical: 14),
                    ),
                  ),
          ],
        ),
      ),
    );
  }
```

改成：
```dart
  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context)!;
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'Nudge',
              style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              l.loginTagline,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey,
                  ),
            ),
            const SizedBox(height: 48),
            _isLoading
                ? const CircularProgressIndicator()
                : ElevatedButton.icon(
                    onPressed: _handleLogin,
                    icon: const Icon(Icons.login, size: 20),
                    label: Text(l.loginSignInWithGoogle),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 24, vertical: 14),
                    ),
                  ),
          ],
        ),
      ),
    );
  }
```

注意：`'Nudge'` 保留（brand）。`const Text(...)` 改成 `Text(l.xxx)` 拿掉 `const`。

- [ ] **Step 12: Analyze**

```bash
cd mobile && flutter analyze lib/features/auth/login_screen.dart && cd ..
```
Expected: `No issues found!`

- [ ] **Step 13: 跑 locale_provider test**

```bash
cd mobile && flutter test test/core/locale_provider_test.dart && cd ..
```
Expected: 6/6 pass。

- [ ] **Step 14: Commit mobile**

```bash
git add mobile/lib/features/auth/login_screen.dart
git commit -m "refactor(mobile): login_screen 字串改用 AppL10n"
```

---

# Task 4: 最終驗證

**Files:** 無

- [ ] **Step 1: i18n check**

```bash
npm run i18n:check
```
Expected: `✅ In sync`

- [ ] **Step 2: Web build**

```bash
npx next build 2>&1 | tail -15
```
Expected: `✓ Compiled successfully`

- [ ] **Step 3: Mobile analyze 全檔**

```bash
cd mobile && flutter analyze 2>&1 | tail -5 && cd ..
```
Expected: `No issues found!`

- [ ] **Step 4: Mobile tests**

```bash
cd mobile && flutter test test/core/locale_provider_test.dart 2>&1 | tail -5 && cd ..
```
Expected: 6/6

- [ ] **Step 5: Git log 收尾**

```bash
git log --oneline -n 6
```

- [ ] **Step 6: 印 QA checklist**

```
========================================================
Phase 7 手動 QA checklist
========================================================

Web (登出狀態 → /zh-TW/login):
  1. Tagline = 「輕量型每日任務推進工具」
  2. 按鈕 = 「使用 Google 帳號登入」
  3. /en/login → "A lightweight nudge for your daily tasks" / "Sign in with Google"
  4. /ja/login → 「毎日のタスクをそっと後押し」/「Google でサインイン」
  5. Brand `Nudge` 不變

Mobile:
  1. 登出 → 看到登入頁
  2. 中文：tagline + button 都是中文
  3. 系統切英文語言 → tagline/button 變英文
  4. 故意斷網 → 點登入 → snackbar 顯示對應語言的「登入失敗...」
========================================================
```

---

## 完成條件

- ✅ `i18n/canonical/*` 含 `login.*` 3 key
- ✅ `npm run i18n:check` `✅ In sync`
- ✅ Web login page 和 mobile login_screen 無中文硬字串（brand `Nudge` 除外）
- ✅ `next build` / `flutter analyze` 都綠
- ✅ `locale_provider_test` 6/6

## 已知限制

- Auth 錯誤不細分原因（單一 `loginFailed`）
- 其他 feature 頁面本體字串留給 Phase 8

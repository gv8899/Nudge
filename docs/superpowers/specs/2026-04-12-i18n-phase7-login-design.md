# Phase 7 設計規格 — Login Page i18n 遷移

**日期：** 2026-04-12
**前置：** Phase 0-6 已 merge。

## 目的

把 web `src/app/[locale]/login/page.tsx` 和 mobile `mobile/lib/features/auth/login_screen.dart` 的字串搬到 i18n canonical。最小、最獨立的一個 phase，適合離線狀態下推進。

## Scope

### 包含

- 新增 top-level `login.*` canonical namespace（3 key）
- Web `src/app/[locale]/login/page.tsx` — tagline + button label
- Mobile `mobile/lib/features/auth/login_screen.dart` — tagline + button label + snackbar

### 不包含

- `Nudge` brand name（不 i18n）
- Google SVG 圖樣 / 色票
- Auth flow 本身 / NextAuth 設定 / `auth_provider.dart` 的邏輯

## 架構決策

### 決策 1 — Namespace：top-level `login.*`

**理由：** login 是獨立頁面 / 獨立 scope，不歸 `common` / `nav` 下。跟 `settings` / `tags` / `nav` 平行。

### 決策 2 — Web 用 `getTranslations` 而非 `useTranslations`

**決定：** `login/page.tsx` 是 server component（async function, uses `auth()` directly）。在 next-intl v4，server component 要用 `getTranslations({ locale, namespace })`，不是 `useTranslations`（後者是 client-only hook）。

**實作：**
```tsx
import { getTranslations } from "next-intl/server";

export default async function LoginPage({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  // ...
  <p>{t("tagline")}</p>
  <button>{t("signInWithGoogle")}</button>
}
```

### 決策 3 — Brand `Nudge` 不 i18n

**理由：** 產品名。零語言版本差異。保持原 JSX `<h1>Nudge</h1>`。

### 決策 4 — 登入錯誤 snackbar 不拆成多種原因

**決定：** 目前 mobile 的 snackbar 是一般「登入失敗，請再試一次」。不細分 network error / OAuth cancel / server error。保留單一 key `login.loginFailed`。

**理由：** YAGNI。Auth provider 目前就回單一 bool，細分錯誤訊息需要先改 auth flow，超出 Phase 7 scope。

## Canonical keys

### zh-TW.json（top-level `login`）

```json
{
  "login": {
    "tagline": "輕量型每日任務推進工具",
    "signInWithGoogle": "使用 Google 帳號登入",
    "loginFailed": "登入失敗，請再試一次"
  }
}
```

### en.json

```json
{
  "login": {
    "tagline": "A lightweight nudge for your daily tasks",
    "signInWithGoogle": "Sign in with Google",
    "loginFailed": "Sign-in failed. Please try again."
  }
}
```

### ja.json

```json
{
  "login": {
    "tagline": "毎日のタスクをそっと後押し",
    "signInWithGoogle": "Google でサインイン",
    "loginFailed": "サインインに失敗しました。もう一度お試しください。"
  }
}
```

### Mobile getter 命名

- `AppL10n.loginTagline`
- `AppL10n.loginSignInWithGoogle`
- `AppL10n.loginLoginFailed`

## 字串對照表

### Web `src/app/[locale]/login/page.tsx`

| 原字串 | key |
|---|---|
| `<h1>Nudge</h1>` | **不改**（brand） |
| `輕量型每日任務推進工具` | `login.tagline` |
| `使用 Google 帳號登入` | `login.signInWithGoogle` |

### Mobile `mobile/lib/features/auth/login_screen.dart`

| 原字串 | key |
|---|---|
| `Text('Nudge', ...)` | **不改**（brand） |
| `'輕量型每日任務推進工具'` | `l.loginTagline` |
| `'使用 Google 帳號登入'` | `l.loginSignInWithGoogle` |
| `'登入失敗，請再試一次'` | `l.loginLoginFailed` |

## 檔案改動

### 修改

- `i18n/canonical/zh-TW.json` / `en.json` / `ja.json` — 加 `login` namespace
- `src/app/[locale]/login/page.tsx` — 加 `getTranslations`，遷移 2 字串
- `mobile/lib/features/auth/login_screen.dart` — 加 `AppL10n`，遷移 3 字串

### 自動生成

- `src/messages/*.json`、`mobile/lib/l10n/app_*.arb`、`app_localizations*.dart`

## 測試策略

- `next build` / `flutter analyze` / `locale_provider_test`
- 手動 QA（離線暫緩）：登入頁切 /zh-TW /en /ja 看 tagline + button 變，登出後再進

## 風險與未解問題

### 風險

- **Server component 的 locale flow**：`getTranslations({ locale })` 需要在 `NextIntlClientProvider` 掛載時已有 messages。Phase 0-3 已驗證過 server component fetch（`[locale]/layout.tsx` 使用 `getMessages()`），所以這個 pattern 不是新路子
- **Mobile snackbar 範圍**：snackbar 顯示時 locale 已經確定，沒 race condition

### 已解

- 不細分 auth 錯誤訊息（留給未來 auth 改版）
- Brand `Nudge` 不 i18n

## 完成條件

- ✅ `i18n/canonical/*` 含 `login.*` 3 key
- ✅ `npm run i18n:check` `✅ In sync`
- ✅ `next build` 通過
- ✅ `flutter analyze` 無 issue、`locale_provider_test` 6/6
- ✅ Login page 無中文硬字串（brand `Nudge` 除外）

## 不做的事

- 不動 auth flow / NextAuth / `auth_provider.dart`
- 不細分錯誤訊息
- 不加 loading text（目前只有 spinner）
- 不改 Google OAuth button 樣式

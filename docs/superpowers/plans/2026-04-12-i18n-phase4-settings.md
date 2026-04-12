# i18n Phase 4 — Settings 遷移 + 語言切換 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 web `settings-modal.tsx` 和 mobile `settings_screen.dart` 的字串搬到 i18n canonical，加上 segmented control 語言切換 UI，切換後 UI 立刻更新（Web 用 next-intl router.replace、Mobile 靠 localeProvider rebuild）。

**Architecture:** 先 seed `settings` canonical namespace（zh-TW 手寫、en/ja 在 plan 裡直接給翻譯），跑 sync.mjs + gen-l10n 產檔。然後 Web / Mobile 各兩 task：先把現有字串遷移到 i18n key（preserve behavior），再加 Language section + PATCH handler。最後一個 QA task 收尾。

**Tech Stack:** next-intl v4、Flutter gen-l10n、Riverpod、Material 3 SegmentedButton。

**Spec：** `docs/superpowers/specs/2026-04-12-i18n-phase4-settings-design.md`

---

## 檔案結構

### 修改

**Canonical：**
- `i18n/canonical/zh-TW.json` — 加 `settings` top-level namespace
- `i18n/canonical/en.json` — 加對應英文翻譯
- `i18n/canonical/ja.json` — 加對應日文翻譯

**生成（sync.mjs 和 gen-l10n 自動產）：**
- `i18n/.i18n-cache.json`
- `src/messages/{zh-TW,en,ja}.json`
- `mobile/lib/l10n/app_{zh,en,ja}.arb`
- `mobile/lib/l10n/app_localizations*.dart`

**Web：**
- `src/components/settings/settings-modal.tsx` — 遷移字串、加 Language section + handler

**Mobile：**
- `mobile/lib/features/settings/settings_screen.dart` — 遷移字串、加 Language section + handler

### 不動（即使字串硬編碼也不改）

- `src/components/tags/tag-manager.tsx`
- `mobile/lib/features/tags/tag_manager.dart`
- `mobile/lib/features/tags/tag_picker.dart`
- `mobile/lib/features/tags/tag_color_picker.dart`

---

# Task 1: Canonical settings namespace + 翻譯 + sync

**Files:**
- Modify: `i18n/canonical/zh-TW.json`
- Modify: `i18n/canonical/en.json`
- Modify: `i18n/canonical/ja.json`
- Generated: `i18n/.i18n-cache.json`, `src/messages/*.json`, `mobile/lib/l10n/app_*.arb`

- [ ] **Step 1: 確認目前 canonical 狀態**

```bash
cat i18n/canonical/zh-TW.json
```
Expected: 只有 `common.save/cancel/delete` 三 key。

- [ ] **Step 2: 加 settings namespace 到 zh-TW.json**

寫 `i18n/canonical/zh-TW.json`：
```json
{
  "common": {
    "save": "儲存",
    "cancel": "取消",
    "delete": "刪除"
  },
  "settings": {
    "title": "設定",
    "account": {
      "section": "帳號資料",
      "unnamed": "未命名",
      "joinedAt": "加入於 {date}"
    },
    "theme": {
      "section": "主題",
      "light": "淺色",
      "dark": "深色",
      "system": "跟隨系統"
    },
    "appearance": {
      "section": "外觀",
      "paperLabel": "紙質感",
      "paperDesc": "讓背景帶有細微的紙張顆粒紋理"
    },
    "language": {
      "section": "語言",
      "zhTW": "繁中",
      "en": "EN",
      "ja": "日本語",
      "auto": "自動",
      "updateFailed": "切換語言失敗，請稍後再試"
    },
    "tags": {
      "section": "標籤管理"
    },
    "cleanUntitled": {
      "label": "清除空白卡片",
      "labelLoading": "清除中…",
      "confirmTitle": "清除空白卡片",
      "confirmBody": "這會刪除所有沒有標題的卡片，確定嗎？",
      "confirmOk": "確定清除",
      "successWithCount": "已清除 {count} 張空白卡片",
      "successEmpty": "沒有需要清除的卡片",
      "failed": "清除失敗"
    },
    "logout": {
      "button": "登出",
      "confirmTitle": "登出",
      "confirmBody": "確定要登出嗎？"
    }
  }
}
```

- [ ] **Step 3: 跑 sync 產生 pending 檔**

```bash
npm run i18n:sync
```
Expected: `📊 Diff: +26 ~0 -0`（新 key 都是 added），寫出 `i18n/.pending-translations.md`，`⚠️ 26 en + 26 ja key(s) pending translation.`

- [ ] **Step 4: 填入 en.json 英文翻譯**

寫 `i18n/canonical/en.json`（整個檔覆蓋，保持 common 的既有翻譯）：
```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "settings": {
    "title": "Settings",
    "account": {
      "section": "Account",
      "unnamed": "Unnamed",
      "joinedAt": "Joined {date}"
    },
    "theme": {
      "section": "Theme",
      "light": "Light",
      "dark": "Dark",
      "system": "System"
    },
    "appearance": {
      "section": "Appearance",
      "paperLabel": "Paper texture",
      "paperDesc": "Subtle paper grain on the background"
    },
    "language": {
      "section": "Language",
      "zhTW": "繁中",
      "en": "EN",
      "ja": "日本語",
      "auto": "Auto",
      "updateFailed": "Couldn't change language. Try again later."
    },
    "tags": {
      "section": "Tags"
    },
    "cleanUntitled": {
      "label": "Clean up empty cards",
      "labelLoading": "Cleaning…",
      "confirmTitle": "Clean up empty cards",
      "confirmBody": "This deletes every untitled card. Are you sure?",
      "confirmOk": "Delete",
      "successWithCount": "Cleaned {count} empty card(s)",
      "successEmpty": "Nothing to clean",
      "failed": "Clean up failed"
    },
    "logout": {
      "button": "Log out",
      "confirmTitle": "Log out",
      "confirmBody": "Log out now?"
    }
  }
}
```

**注意：** language section 的 `zhTW / en / ja` 三個 segment label 在所有語言維持自語言寫法（國際標準：語言選單裡每個選項用自己的語言顯示），所以英文檔裡也是 `繁中 / EN / 日本語`。只有 `auto` 翻成 "Auto"。

- [ ] **Step 5: 填入 ja.json 日文翻譯**

寫 `i18n/canonical/ja.json`：
```json
{
  "common": {
    "save": "保存",
    "cancel": "キャンセル",
    "delete": "削除"
  },
  "settings": {
    "title": "設定",
    "account": {
      "section": "アカウント",
      "unnamed": "名称未設定",
      "joinedAt": "{date} 登録"
    },
    "theme": {
      "section": "テーマ",
      "light": "ライト",
      "dark": "ダーク",
      "system": "システム"
    },
    "appearance": {
      "section": "外観",
      "paperLabel": "紙質感",
      "paperDesc": "背景に紙のざらつきを加えます"
    },
    "language": {
      "section": "言語",
      "zhTW": "繁中",
      "en": "EN",
      "ja": "日本語",
      "auto": "自動",
      "updateFailed": "言語を切り替えできませんでした。後で再試行してください。"
    },
    "tags": {
      "section": "タグ"
    },
    "cleanUntitled": {
      "label": "空白カードを削除",
      "labelLoading": "削除中…",
      "confirmTitle": "空白カードを削除",
      "confirmBody": "タイトル未入力のカードがすべて削除されます。よろしいですか？",
      "confirmOk": "削除する",
      "successWithCount": "{count} 件の空白カードを削除しました",
      "successEmpty": "削除対象がありません",
      "failed": "削除に失敗しました"
    },
    "logout": {
      "button": "ログアウト",
      "confirmTitle": "ログアウト",
      "confirmBody": "本当にログアウトしますか？"
    }
  }
}
```

- [ ] **Step 6: 再跑 sync，pending 應被清掉**

```bash
npm run i18n:sync
```
Expected:
- `📊 Diff: +0 ~0 -0`
- `🗑  Removed stale ...pending-translations.md`
- `✅ Sync 完成`

- [ ] **Step 7: `i18n:check` 驗證 in sync**

```bash
npm run i18n:check
```
Expected: `✅ In sync`

- [ ] **Step 8: Commit**

```bash
git add i18n/ src/messages/ mobile/lib/l10n/app_zh.arb mobile/lib/l10n/app_en.arb mobile/lib/l10n/app_ja.arb
git commit -m "feat(i18n): 加 settings namespace canonical 和 en/ja 翻譯"
```

---

# Task 2: 重跑 flutter gen-l10n 生出新的 AppL10n getter

**Files:**
- Generated: `mobile/lib/l10n/app_localizations.dart`
- Generated: `mobile/lib/l10n/app_localizations_zh.dart`
- Generated: `mobile/lib/l10n/app_localizations_en.dart`
- Generated: `mobile/lib/l10n/app_localizations_ja.dart`

- [ ] **Step 1: 跑 gen-l10n**

```bash
cd mobile && flutter gen-l10n && cd ..
```
Expected: 無錯、無 warning（除了既有的 l10n.yaml 提醒）。

- [ ] **Step 2: 驗證新 getter 存在**

```bash
grep -cE "settingsTitle|settingsLanguageZhTW|settingsLogoutButton|settingsCleanUntitledConfirmTitle" mobile/lib/l10n/app_localizations.dart
```
Expected: `4`（四個都應命中）。

**命名規則：** `settings.language.zhTW` → `settingsLanguageZhTW`（flatten.mjs 把每個 dot 段的首字大寫，段內字母保留原樣）。`settings.logout.button` → `settingsLogoutButton`。

- [ ] **Step 3: Analyze l10n 生成檔**

```bash
cd mobile && flutter analyze lib/l10n/ && cd ..
```
Expected: `No issues found!`

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/l10n/app_localizations*.dart
git commit -m "feat(mobile): 重跑 gen-l10n 產出新 AppL10n settings getter"
```

---

# Task 3: Web — 遷移現有 settings-modal 字串到 useTranslations

**Files:**
- Modify: `src/components/settings/settings-modal.tsx`

目標：把現有硬字串都改用 `useTranslations('settings')`，UX 行為**完全不變**，不加 Language section（Task 4 處理）。

- [ ] **Step 1: 讀現有檔以建立 mental model**

```bash
wc -l src/components/settings/settings-modal.tsx
```
Expected: 172 行。

- [ ] **Step 2: 修改 imports 加 useTranslations**

把第 1-14 行的 import block 的 `"use client";` 那段保留，然後：

找到：
```tsx
"use client";

import useSWR from "swr";
import { signOut } from "next-auth/react";
import { Sun, Moon, Monitor, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme, type Theme } from "@/components/providers/theme-provider";
import { fetcher } from "@/lib/fetcher";
import { TagManager } from "@/components/tags/tag-manager";
import { format, parseISO } from "date-fns";
```

加一行 next-intl import：
```tsx
"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { Sun, Moon, Monitor, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme, type Theme } from "@/components/providers/theme-provider";
import { fetcher } from "@/lib/fetcher";
import { TagManager } from "@/components/tags/tag-manager";
import { format, parseISO } from "date-fns";
```

- [ ] **Step 3: 刪掉 PAPER_LABEL / PAPER_DESC 常數**

找到：
```tsx
// 紙感顆粒紋理開關（用於 settings modal）
const PAPER_LABEL = "紙質感";
const PAPER_DESC = "讓背景帶有細微的紙張顆粒紋理";
```

刪除這三行。

- [ ] **Step 4: themeOptions label 改 key-only（不寫死中文）**

找到：
```tsx
const themeOptions: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "跟隨系統", Icon: Monitor },
];
```

改成（用 key 當 placeholder，render 時才翻譯）：
```tsx
const themeOptions: { value: Theme; key: "light" | "dark" | "system"; Icon: typeof Sun }[] = [
  { value: "light", key: "light", Icon: Sun },
  { value: "dark", key: "dark", Icon: Moon },
  { value: "system", key: "system", Icon: Monitor },
];
```

- [ ] **Step 5: 在 component function 頂部加 useTranslations**

找到：
```tsx
export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { data: me } = useSWR<MeResponse>(open ? "/api/me" : null, fetcher);
  const { theme, setTheme, paperTexture, setPaperTexture } = useTheme();
  const paperOn = paperTexture === "on";
```

改成：
```tsx
export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const t = useTranslations("settings");
  const { data: me } = useSWR<MeResponse>(open ? "/api/me" : null, fetcher);
  const { theme, setTheme, paperTexture, setPaperTexture } = useTheme();
  const paperOn = paperTexture === "on";
```

- [ ] **Step 6: 遷移 DialogTitle**

找到：
```tsx
<DialogTitle className="text-lg font-semibold">設定</DialogTitle>
```

改成：
```tsx
<DialogTitle className="text-lg font-semibold">{t("title")}</DialogTitle>
```

- [ ] **Step 7: 遷移帳號資料 section**

找到：
```tsx
{/* 帳號資料 */}
<section className="py-4">
  <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
    帳號資料
  </h3>
```

改成：
```tsx
{/* 帳號資料 */}
<section className="py-4">
  <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
    {t("account.section")}
  </h3>
```

找到：
```tsx
<div className="text-sm font-medium text-foreground truncate">
  {me.name || "未命名"}
</div>
```

改成：
```tsx
<div className="text-sm font-medium text-foreground truncate">
  {me.name || t("account.unnamed")}
</div>
```

找到：
```tsx
<div className="text-xs text-text-faint mt-0.5">
  加入於 {format(parseISO(me.createdAt), "yyyy/MM/dd")}
</div>
```

改成（用 next-intl ICU placeholder）：
```tsx
<div className="text-xs text-text-faint mt-0.5">
  {t("account.joinedAt", { date: format(parseISO(me.createdAt), "yyyy/MM/dd") })}
</div>
```

- [ ] **Step 8: 遷移主題 section**

找到：
```tsx
{/* 主題切換 */}
<section className="py-4">
  <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
    主題
  </h3>
  <div
    role="radiogroup"
    aria-label="主題切換"
    className="grid grid-cols-3 gap-2"
  >
    {themeOptions.map(({ value, label, Icon }) => {
      const active = theme === value;
      return (
        <button
          key={value}
          role="radio"
          aria-checked={active}
          onClick={() => setTheme(value)}
          className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs transition-colors ${
            active
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-text-dim hover:border-border-light hover:text-foreground"
          }`}
        >
          <Icon className="h-5 w-5" />
          {label}
        </button>
      );
    })}
  </div>
</section>
```

改成：
```tsx
{/* 主題切換 */}
<section className="py-4">
  <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
    {t("theme.section")}
  </h3>
  <div
    role="radiogroup"
    aria-label={t("theme.section")}
    className="grid grid-cols-3 gap-2"
  >
    {themeOptions.map(({ value, key, Icon }) => {
      const active = theme === value;
      return (
        <button
          key={value}
          role="radio"
          aria-checked={active}
          onClick={() => setTheme(value)}
          className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs transition-colors ${
            active
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-text-dim hover:border-border-light hover:text-foreground"
          }`}
        >
          <Icon className="h-5 w-5" />
          {t(`theme.${key}`)}
        </button>
      );
    })}
  </div>
</section>
```

- [ ] **Step 9: 遷移外觀 section**

找到：
```tsx
{/* 紙質感開關 */}
<section className="py-4">
  <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
    外觀
  </h3>
  <div className="flex items-center justify-between gap-3">
    <div className="flex-1 min-w-0">
      <div className="text-sm text-foreground">{PAPER_LABEL}</div>
      <div className="text-xs text-text-dim mt-0.5">{PAPER_DESC}</div>
    </div>
    <button
      role="switch"
      aria-checked={paperOn}
      aria-label={PAPER_LABEL}
```

改成：
```tsx
{/* 紙質感開關 */}
<section className="py-4">
  <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
    {t("appearance.section")}
  </h3>
  <div className="flex items-center justify-between gap-3">
    <div className="flex-1 min-w-0">
      <div className="text-sm text-foreground">{t("appearance.paperLabel")}</div>
      <div className="text-xs text-text-dim mt-0.5">{t("appearance.paperDesc")}</div>
    </div>
    <button
      role="switch"
      aria-checked={paperOn}
      aria-label={t("appearance.paperLabel")}
```

- [ ] **Step 10: 遷移標籤管理 section**

找到：
```tsx
{/* 標籤管理 */}
<section className="py-4">
  <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
    標籤管理
  </h3>
  <TagManager />
</section>
```

改成：
```tsx
{/* 標籤管理 */}
<section className="py-4">
  <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
    {t("tags.section")}
  </h3>
  <TagManager />
</section>
```

- [ ] **Step 11: 遷移登出 button**

找到：
```tsx
{/* 登出 */}
<section className="py-4">
  <button
    onClick={handleSignOut}
    className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
  >
    <LogOut className="h-4 w-4" />
    登出
  </button>
</section>
```

改成：
```tsx
{/* 登出 */}
<section className="py-4">
  <button
    onClick={handleSignOut}
    className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
  >
    <LogOut className="h-4 w-4" />
    {t("logout.button")}
  </button>
</section>
```

- [ ] **Step 12: 驗證 build**

```bash
npx next build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`, no TypeScript errors.

- [ ] **Step 13: Commit**

```bash
git add src/components/settings/settings-modal.tsx
git commit -m "refactor(web): settings-modal 字串改用 useTranslations"
```

---

# Task 4: Web — 加 Language segmented control + live update

**Files:**
- Modify: `src/components/settings/settings-modal.tsx`

目標：在主題和外觀之間插入 Language section，使用者點 segment → PATCH /api/me/locale → router.replace 到新 locale 的 URL（或 auto 時 reload 根路徑）。

- [ ] **Step 1: 加 imports**

找到（Task 3 結尾的 import block）：
```tsx
"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
```

改成：
```tsx
"use client";

import useSWR, { useSWRConfig } from "swr";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
```

在 `import { useTheme, type Theme } from "@/components/providers/theme-provider";` 之後加一行：
```tsx
import { useRouter, usePathname, type Locale } from "@/i18n/routing";
```

- [ ] **Step 2: 擴充 MeResponse type 含 locale**

找到：
```tsx
interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}
```

改成：
```tsx
interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  locale: Locale | null;
  createdAt: string;
}
```

- [ ] **Step 3: 加 LOCALES 常數**

在 `themeOptions` 常數正下方加：
```tsx
const LOCALE_OPTIONS: {
  key: "zhTW" | "en" | "ja" | "auto";
  value: Locale | null;
}[] = [
  { key: "zhTW", value: "zh-TW" },
  { key: "en", value: "en" },
  { key: "ja", value: "ja" },
  { key: "auto", value: null },
];
```

- [ ] **Step 4: 在 component 頂部加 hooks + handler**

找到（Task 3 結尾的 component opener）：
```tsx
export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const t = useTranslations("settings");
  const { data: me } = useSWR<MeResponse>(open ? "/api/me" : null, fetcher);
  const { theme, setTheme, paperTexture, setPaperTexture } = useTheme();
  const paperOn = paperTexture === "on";

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };
```

改成：
```tsx
export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const t = useTranslations("settings");
  const { data: me } = useSWR<MeResponse>(open ? "/api/me" : null, fetcher);
  const { theme, setTheme, paperTexture, setPaperTexture } = useTheme();
  const paperOn = paperTexture === "on";

  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  async function handleLocaleChange(value: Locale | null) {
    try {
      const res = await fetch("/api/me/locale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: value }),
      });
      if (!res.ok) throw new Error("patch failed");
      await mutate("/api/me");
      if (value === null) {
        // auto：清了 cookie、讓 middleware 依 Accept-Language 重新決定
        window.location.href = "/";
      } else {
        router.replace(pathname, { locale: value });
      }
    } catch {
      alert(t("language.updateFailed"));
    }
  }
```

- [ ] **Step 5: 插入 Language section 到 JSX**

找到（主題 section 的結尾 `</section>` 後，外觀 section 前）：
```tsx
        </div>
      </section>

      {/* 紙質感開關 */}
      <section className="py-4">
```

改成：
```tsx
        </div>
      </section>

      {/* 語言切換 */}
      <section className="py-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
          {t("language.section")}
        </h3>
        <div
          role="radiogroup"
          aria-label={t("language.section")}
          className="flex rounded-lg border border-border p-0.5 gap-0.5"
        >
          {LOCALE_OPTIONS.map(({ key, value }) => {
            const active =
              value === null ? !me?.locale : me?.locale === value;
            return (
              <button
                key={key}
                role="radio"
                aria-checked={active}
                onClick={() => handleLocaleChange(value)}
                className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-text-dim hover:text-foreground"
                }`}
              >
                {t(`language.${key}`)}
              </button>
            );
          })}
        </div>
      </section>

      {/* 紙質感開關 */}
      <section className="py-4">
```

- [ ] **Step 6: Build 驗證**

```bash
npx next build 2>&1 | tail -15
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Commit**

```bash
git add src/components/settings/settings-modal.tsx
git commit -m "feat(web): settings-modal 加語言 segmented control + live update"
```

---

# Task 5: Mobile — 遷移 settings_screen 字串到 AppL10n

**Files:**
- Modify: `mobile/lib/features/settings/settings_screen.dart`

目標：`settings_screen.dart` 裡的所有字串（含 inline dialog 和子 widget `_ThemeSelector`、`_UserProfile`、`_CleanUntitledButton`）改 `AppL10n.of(context)!.xxx`。

- [ ] **Step 1: 加 import**

找到檔案第 1-10 行的 import block：
```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme.dart';
import '../../core/theme_provider.dart';
import '../auth/auth_provider.dart';
import '../cards/cards_provider.dart';
import '../tags/tag_manager.dart';
```

加一行：
```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme.dart';
import '../../core/theme_provider.dart';
import '../../l10n/app_localizations.dart';
import '../auth/auth_provider.dart';
import '../cards/cards_provider.dart';
import '../tags/tag_manager.dart';
```

- [ ] **Step 2: 遷移 SettingsScreen build method 的標題 + 登出 + 登出 confirm dialog**

找到：
```dart
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final themeMode = ref.watch(themeProvider);

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const SizedBox(height: 16),
            Text(
              '設定',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.foreground,
              ),
            ),
```

改成：
```dart
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final themeMode = ref.watch(themeProvider);
    final l = AppL10n.of(context)!;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const SizedBox(height: 16),
            Text(
              l.settingsTitle,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.foreground,
              ),
            ),
```

接著找到登出 button：
```dart
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _confirmLogout(context, ref),
                icon: const Icon(LucideIcons.logOut, size: 18),
                label: const Text('登出'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.destructive,
                  side: BorderSide(color: AppColors.destructiveBorder),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
```

改成：
```dart
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _confirmLogout(context, ref),
                icon: const Icon(LucideIcons.logOut, size: 18),
                label: Text(l.settingsLogoutButton),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.destructive,
                  side: BorderSide(color: AppColors.destructiveBorder),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
```

- [ ] **Step 3: 遷移 _confirmLogout dialog（整塊替換）**

找到（`settings_screen.dart:74-96`）：
```dart
  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('登出', style: TextStyle(fontSize: 16)),
        content: Text(
          '確定要登出嗎？',
          style: TextStyle(fontSize: 14, color: AppColors.textDim),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('登出', style: TextStyle(color: AppColors.destructive)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      ref.read(authProvider.notifier).logout();
    }
  }
```

整段替換成：
```dart
  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final l = AppL10n.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text(l.settingsLogoutConfirmTitle, style: const TextStyle(fontSize: 16)),
        content: Text(
          l.settingsLogoutConfirmBody,
          style: TextStyle(fontSize: 14, color: AppColors.textDim),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l.commonCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l.settingsLogoutButton, style: TextStyle(color: AppColors.destructive)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      ref.read(authProvider.notifier).logout();
    }
  }
```

- [ ] **Step 4: 遷移 _UserProfile widget**

找到 `_UserProfile` build method 開頭（`settings_screen.dart:104-108`）：
```dart
  @override
  Widget build(BuildContext context) {
    final name = user['name'] as String? ?? '未命名';
    final email = user['email'] as String? ?? '';
    final avatarUrl = user['avatarUrl'] as String?;
    final createdAt = user['createdAt'] as String?;
```

改成：
```dart
  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context)!;
    final name = user['name'] as String? ?? l.settingsAccountUnnamed;
    final email = user['email'] as String? ?? '';
    final avatarUrl = user['avatarUrl'] as String?;
    final createdAt = user['createdAt'] as String?;
```

然後找到加入日期顯示（`settings_screen.dart:154-161`）：
```dart
              if (joinDate != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    '加入於 $joinDate',
                    style: TextStyle(fontSize: 11, color: AppColors.textFaint),
                  ),
                ),
```

改成：
```dart
              if (joinDate != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    l.settingsAccountJoinedAt(joinDate),
                    style: TextStyle(fontSize: 11, color: AppColors.textFaint),
                  ),
                ),
```

**Dart gen-l10n placeholder signature：** canonical 的 `"加入於 {date}"` 會被 `buildArbJson` 加上 `@settingsAccountJoinedAt.placeholders.date.type = "Object"`。gen-l10n 生出 `String settingsAccountJoinedAt(Object date)`（positional，單一參數）。所以 `l.settingsAccountJoinedAt(joinDate)` 是正確用法。若生成方式改變，按 `flutter analyze` 的錯誤訊息調整即可。

- [ ] **Step 5: 遷移 _ThemeSelector**

**觀察：** `_ThemeSelector` 本身沒有「主題」標題（檢視 line 196-229），它只 render 三個 `_ThemeOption`，label 分別是 `'淺色'`、`'深色'`、`'跟隨系統'`。標題是在 `SettingsScreen.build` 直接 Row + `_ThemeSelector` 的前後沒有 section title（Task 0 移除過多 redundant section title）。所以這一步只要遷移 `_ThemeSelector` 內的三個 label 字串。

找到（`settings_screen.dart:196-229`）：
```dart
class _ThemeSelector extends StatelessWidget {
  final AppThemeMode current;
  final ValueChanged<AppThemeMode> onChanged;

  const _ThemeSelector({required this.current, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _ThemeOption(
          icon: LucideIcons.sun,
          label: '淺色',
          isSelected: current == AppThemeMode.light,
          onTap: () => onChanged(AppThemeMode.light),
        ),
        const SizedBox(width: 8),
        _ThemeOption(
          icon: LucideIcons.moon,
          label: '深色',
          isSelected: current == AppThemeMode.dark,
          onTap: () => onChanged(AppThemeMode.dark),
        ),
        const SizedBox(width: 8),
        _ThemeOption(
          icon: LucideIcons.monitor,
          label: '跟隨系統',
          isSelected: current == AppThemeMode.system,
          onTap: () => onChanged(AppThemeMode.system),
        ),
      ],
    );
  }
}
```

整塊替換成：
```dart
class _ThemeSelector extends StatelessWidget {
  final AppThemeMode current;
  final ValueChanged<AppThemeMode> onChanged;

  const _ThemeSelector({required this.current, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context)!;
    return Row(
      children: [
        _ThemeOption(
          icon: LucideIcons.sun,
          label: l.settingsThemeLight,
          isSelected: current == AppThemeMode.light,
          onTap: () => onChanged(AppThemeMode.light),
        ),
        const SizedBox(width: 8),
        _ThemeOption(
          icon: LucideIcons.moon,
          label: l.settingsThemeDark,
          isSelected: current == AppThemeMode.dark,
          onTap: () => onChanged(AppThemeMode.dark),
        ),
        const SizedBox(width: 8),
        _ThemeOption(
          icon: LucideIcons.monitor,
          label: l.settingsThemeSystem,
          isSelected: current == AppThemeMode.system,
          onTap: () => onChanged(AppThemeMode.system),
        ),
      ],
    );
  }
}
```

- [ ] **Step 6: 遷移 _CleanUntitledButton（含 dialog + snackbar）**

找到 `_clean()` method（`settings_screen.dart:296-340`）：
```dart
  Future<void> _clean() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('清除空白卡片', style: TextStyle(fontSize: 16)),
        content: Text(
          '這會刪除所有沒有標題的卡片，確定嗎？',
          style: TextStyle(fontSize: 14, color: AppColors.textDim),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('確定清除', style: TextStyle(color: AppColors.destructive)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.dio.delete('/api/cards/untitled');
      final deleted = res.data['deleted'] ?? 0;
      ref.invalidate(cardsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(deleted > 0 ? '已清除 $deleted 張空白卡片' : '沒有需要清除的卡片'),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('清除失敗')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
```

整塊替換成：
```dart
  Future<void> _clean() async {
    final l = AppL10n.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text(l.settingsCleanUntitledConfirmTitle, style: const TextStyle(fontSize: 16)),
        content: Text(
          l.settingsCleanUntitledConfirmBody,
          style: TextStyle(fontSize: 14, color: AppColors.textDim),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l.commonCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              l.settingsCleanUntitledConfirmOk,
              style: TextStyle(color: AppColors.destructive),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.dio.delete('/api/cards/untitled');
      final deleted = (res.data['deleted'] as int?) ?? 0;
      ref.invalidate(cardsProvider);
      if (mounted) {
        final msg = deleted > 0
            ? l.settingsCleanUntitledSuccessWithCount(deleted)
            : l.settingsCleanUntitledSuccessEmpty;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l.settingsCleanUntitledFailed)),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
```

然後找到 `_CleanUntitledButtonState.build`（`settings_screen.dart:342-360`）：
```dart
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: _loading ? null : _clean,
        icon: _loading
            ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textDim))
            : Icon(LucideIcons.eraser, size: 18),
        label: Text(_loading ? '清除中…' : '清除空白卡片'),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textDim,
          side: BorderSide(color: AppColors.border),
          padding: const EdgeInsets.symmetric(vertical: 12),
        ),
      ),
    );
  }
```

替換成：
```dart
  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context)!;
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: _loading ? null : _clean,
        icon: _loading
            ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textDim))
            : Icon(LucideIcons.eraser, size: 18),
        label: Text(_loading ? l.settingsCleanUntitledLabelLoading : l.settingsCleanUntitledLabel),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textDim,
          side: BorderSide(color: AppColors.border),
          padding: const EdgeInsets.symmetric(vertical: 12),
        ),
      ),
    );
  }
```

**注意：** `l.settingsCleanUntitledSuccessWithCount(deleted)` 的 `deleted` 是 `int`。canonical 的 `"已清除 {count} 張空白卡片"` 會讓 gen-l10n 生出 `String settingsCleanUntitledSuccessWithCount(Object count)`（因為 transpile.mjs 偵測到非 plural/select 給 `Object` type）。傳 int 會被自動當 Object，Dart runtime 會 toString，OK。若 `flutter analyze` 抱怨 type，改 `l.settingsCleanUntitledSuccessWithCount(deleted.toString())`。

- [ ] **Step 7: flutter analyze**

```bash
cd mobile && flutter analyze lib/features/settings/settings_screen.dart && cd ..
```
Expected: `No issues found!`

若有 analyze error，通常是：
- `l.settingsAccountJoinedAt(formatted)` 的 signature 不對（改成 named arg 或檢查 gen-l10n 輸出）
- 少 import `app_localizations.dart`
- getter 名稱拼錯（看 `grep setting mobile/lib/l10n/app_localizations.dart` 對照）

- [ ] **Step 8: 跑 locale_provider test 確認沒牽連到**

```bash
cd mobile && flutter test test/core/locale_provider_test.dart && cd ..
```
Expected: `6 tests passed`.

- [ ] **Step 9: Commit**

```bash
git add mobile/lib/features/settings/settings_screen.dart
git commit -m "refactor(mobile): settings_screen 字串改用 AppL10n"
```

---

# Task 6: Mobile — 加 Language SegmentedButton + live update

**Files:**
- Modify: `mobile/lib/features/settings/settings_screen.dart`

- [ ] **Step 1: 加 imports（locale provider + api client）**

在現有 imports 後加：
```dart
import '../../core/locale_provider.dart';
```

注意：`api_client.dart` 和 `auth_provider.dart` 已經 export 的 `apiClientProvider`，Task 3.5 已寫好。這裡不用再加。

- [ ] **Step 2: 在 SettingsScreen build method 插入 Language section**

找到（Task 5 的結果，在 `_ThemeSelector` 後、`TagManager` 前）：
```dart
            // 主題
            _ThemeSelector(
              current: themeMode,
              onChanged: (mode) => ref.read(themeProvider.notifier).setTheme(mode),
            ),
            const SizedBox(height: 24),

            // 標籤管理（TagManager 自己有標題）
            const TagManager(),
```

改成：
```dart
            // 主題
            _ThemeSelector(
              current: themeMode,
              onChanged: (mode) => ref.read(themeProvider.notifier).setTheme(mode),
            ),
            const SizedBox(height: 24),

            // 語言
            const _LanguageSection(),
            const SizedBox(height: 24),

            // 標籤管理（TagManager 自己有標題）
            const TagManager(),
```

- [ ] **Step 3: 在檔案底部加 _LanguageSection widget**

在檔案最後（最後一個 class 後）加：

```dart
/// 語言切換 segment。4 段：繁中 / EN / 日本語 / 自動。
class _LanguageSection extends ConsumerWidget {
  const _LanguageSection();

  static const _options = <({String key, Locale? locale})>[
    (key: 'zhTW', locale: Locale('zh', 'TW')),
    (key: 'en', locale: Locale('en')),
    (key: 'ja', locale: Locale('ja')),
    (key: 'auto', locale: null),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppL10n.of(context)!;
    final current = ref.watch(localeProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            l.settingsLanguageSection,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: AppColors.textDim,
              letterSpacing: 0.5,
            ),
          ),
        ),
        SegmentedButton<String>(
          segments: _options.map((o) {
            return ButtonSegment<String>(
              value: o.key,
              label: Text(_labelFor(o.key, l)),
            );
          }).toList(),
          selected: {_selectedKey(current)},
          showSelectedIcon: false,
          onSelectionChanged: (set) => _handleChange(context, ref, set.first),
          style: ButtonStyle(
            textStyle: WidgetStateProperty.all(const TextStyle(fontSize: 12)),
            padding: WidgetStateProperty.all(
              const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            ),
          ),
        ),
      ],
    );
  }

  String _labelFor(String key, AppL10n l) {
    switch (key) {
      case 'zhTW':
        return l.settingsLanguageZhTW;
      case 'en':
        return l.settingsLanguageEn;
      case 'ja':
        return l.settingsLanguageJa;
      case 'auto':
      default:
        return l.settingsLanguageAuto;
    }
  }

  String _selectedKey(Locale? current) {
    if (current == null) return 'auto';
    final tag = formatLocaleTag(current);
    if (tag == 'zh-TW') return 'zhTW';
    if (tag == 'en') return 'en';
    if (tag == 'ja') return 'ja';
    return 'auto';
  }

  Future<void> _handleChange(
    BuildContext context,
    WidgetRef ref,
    String key,
  ) async {
    final option = _options.firstWhere((o) => o.key == key);
    final tag = option.locale == null ? null : formatLocaleTag(option.locale!);

    try {
      await ref.read(apiClientProvider).dio.patch(
        '/api/me/locale',
        data: {'locale': tag},
      );
      if (option.locale == null) {
        await ref.read(localeProvider.notifier).clearLocale();
      } else {
        await ref.read(localeProvider.notifier).setLocale(option.locale!);
      }
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppL10n.of(context)!.settingsLanguageUpdateFailed),
        ),
      );
    }
  }
}
```

- [ ] **Step 4: flutter analyze**

```bash
cd mobile && flutter analyze lib/features/settings/settings_screen.dart && cd ..
```
Expected: `No issues found!`

若有錯：
- `apiClientProvider` 沒 export — 檢查是否該 import `../auth/auth_provider.dart`（已經 import 了）
- `Locale('zh', 'TW')` 不是 const — Flutter 的 Locale 是 const constructor，可用

- [ ] **Step 5: flutter test 確認沒破壞既有 test**

```bash
cd mobile && flutter test test/core/locale_provider_test.dart && cd ..
```
Expected: `6 tests passed`.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/features/settings/settings_screen.dart
git commit -m "feat(mobile): settings_screen 加語言 SegmentedButton + live update"
```

---

# Task 7: 最終驗證 + QA checklist

**Files:** 無（純驗證 + 手動 QA 說明）

- [ ] **Step 1: `i18n:check` 同步驗證**

```bash
npm run i18n:check
```
Expected: `✅ In sync`

- [ ] **Step 2: Web build**

```bash
npx next build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`, 24+ routes 列出。

- [ ] **Step 3: Mobile analyze 全檔**

```bash
cd mobile && flutter analyze 2>&1 | tail -5 && cd ..
```
Expected: `No issues found!`

- [ ] **Step 4: Mobile tests**

```bash
cd mobile && flutter test test/core/locale_provider_test.dart 2>&1 | tail -5 && cd ..
```
Expected: `All tests passed!` (6 tests)

- [ ] **Step 5: 手動 QA checklist（列印給人類跑）**

把以下 checklist 印在 terminal，提醒使用者跑過一次：

```
============================================================
Phase 4 手動 QA checklist（跑 npm run dev 和 flutter run）
============================================================

## Web

1. 登入到 /zh-TW/day/<today>
2. 打開設定 modal
3. 確認 title = "設定"
4. 確認看到 5 個 section：帳號資料 / 主題 / 語言 / 外觀 / 標籤管理
5. 語言 section 顯示 4 個 segment：繁中 / EN / 日本語 / 自動
6. 點「EN」：
   a. URL 變 /en/day/...
   b. 所有字（除標籤管理）變英文
   c. Segmented 的「EN」active
7. 點「日本語」：同上變日文
8. 點「自動」：頁面 reload 到 /，middleware 根據 Accept-Language 決定
9. 設定 DevTools 模擬 Accept-Language = en，點「自動」應該落在 /en/
10. 斷網路後點切換 → 應看到 alert toast

## Mobile

1. 登入後進設定頁
2. 確認 title = "設定"
3. 語言 section 用 SegmentedButton 4 段顯示
4. 點「EN」：
   a. title 立刻變 "Settings"
   b. 所有字（除標籤管理）變英文
   c. Date picker（打開 time 欄位）變英文
5. 點「日本語」→ 日文
6. 點「自動」→ 回系統語言（若系統是中文則變回繁中）
7. kill app 重開 → 語言設定要持久（SharedPreferences）
8. 斷網測試：模擬 API 失敗 → 應看到 snackbar

============================================================
```

- [ ] **Step 6: Commit 若有任何 lint/format 變動**

```bash
git status
git add -A
git commit -m "chore(i18n): Phase 4 最終驗證" || echo "nothing to commit"
```

---

## 完成條件

- ✅ `i18n/canonical/zh-TW.json` / `en.json` / `ja.json` 含 settings namespace 25+ key
- ✅ `npm run i18n:check` 回 `✅ In sync`
- ✅ Web: `useTranslations('settings')` 用在 settings-modal 的所有字串
- ✅ Web: Language segmented control 可切 4 段、live update 立即生效
- ✅ Mobile: `AppL10n.of(context)!` 用在 settings_screen 的所有字串
- ✅ Mobile: Language SegmentedButton 可切 4 段、`localeProvider` + `SharedPreferences` 持久化
- ✅ 切換失敗時 Web alert、Mobile snackbar
- ✅ `next build` 通過、`flutter analyze` 無 issue、`flutter test` 6/6

## 已知限制（仍然是中文，延到 Phase 5+）

- `TagManager` 內部所有字串
- 其他 feature 頁面（cards / notes / day view / sidebar / header / login page）
- 錯誤 boundary 的訊息

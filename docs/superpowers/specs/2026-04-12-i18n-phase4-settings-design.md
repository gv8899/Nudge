# Phase 4 設計規格 — 設定頁 i18n 遷移 + 語言切換 UI

**日期：** 2026-04-12
**前置條件：** `docs/superpowers/specs/2026-04-12-i18n-design.md` + `docs/superpowers/plans/2026-04-12-i18n-foundation.md`（Phase 0-3）已完成並 merge。

## 目的

把設定頁（web SettingsModal + mobile SettingsScreen）的字串搬到 i18n canonical，加上語言切換 UI。這是第一個實際 dogfood Phase 0-3 foundation 的 feature — 驗證 canonical → transpile → 執行時切換的完整通路能在真實畫面上運作。

## Scope

### 包含

- `src/components/settings/settings-modal.tsx` 所有字串
- `mobile/lib/features/settings/settings_screen.dart` 所有字串，含 inline 的 `_confirmLogout` dialog 和 `_CleanUntitledButton` 的所有狀態文字
- 新增 `settings.language` canonical namespace
- 新增「語言」section UI（segmented control 4 段：`繁中 / EN / 日本語 / 自動`）
- 切換後 live update（不用 reload），`PATCH /api/me/locale` 同步到 server

### 不包含（延到 Phase 5+ 或更後）

- `TagManager`（web + mobile，因為也用在卡片詳細頁）
- `TagColorPicker`、`tag_picker.dart` 等子元件
- Sidebar / header / 所有 feature 頁面（cards / notes / day view / login page）
- 錯誤 boundary / i18n 的 fallback 測試
- Push notification 文案（Phase 9）

## 架構決策

### 決策 1 — 範圍：只搬設定頁本體

**決定：** 只改 `settings-modal.tsx` 和 `settings_screen.dart` 兩個檔；`TagManager` 等子元件暫時保留中文。

**理由：**

- 第一次 dogfooding，首要目標是驗證「通路能動」而不是「切英文零中文殘留」
- TagManager 被卡片詳細頁共用，遷移它等於順便改到 cards，scope 會爆
- 接受「標籤管理」section 內部切英文時仍為中文的暫時缺陷（會記在 known-issues）

### 決策 2 — UI：Segmented Control，4 段（自語言寫法 B 變體）

**決定：** 橫向 segmented，四段為 `繁中 | EN | 日本語 | 自動`。

**理由：**

- Segmented control 一眼看到所有選項、不用多一次點擊
- 4 段包含「自動」讓使用者可以明確「還給系統決定」
- 短碼 `繁中 / EN / 日本語` 在四段空間裡最適當（`English` 太長會擠到）

**平台差異：**

- **Web：** 自刻 `<div>` segmented（flex + border + active 狀態用 primary/10），保持和既有「主題」radio 的視覺一致性
- **Mobile：** 用 Material 3 `SegmentedButton`。與 web 不完全像素對齊，但兩邊都是 segmented 語義，接受細微差異

### 決策 3 — 切換行為：Live update

**決定：** 使用者點語言 segment 後立刻更新 UI，不要求 reload。

**實作：**

- **Web：**
  - `PATCH /api/me/locale` 更新 DB + 寫 `NEXT_LOCALE` cookie
  - `useSWRConfig().mutate('/api/me')` 重新拉 user 資料
  - 特定語言：用 next-intl `useRouter().replace(pathname, { locale: newLocale })` 切到新 URL，`NextIntlClientProvider` 會自動 rebuild 整棵 server component tree
  - 自動（locale=null）：`window.location.href = '/'`，讓 middleware 依 `Accept-Language` 重新決定

- **Mobile：**
  - `PATCH /api/me/locale` 更新 DB
  - `ref.read(localeProvider.notifier).setLocale(...)` 或 `clearLocale()`
  - `MaterialApp` 因 `ref.watch(localeProvider)` rebuild，`AppL10n` delegate 重新解析，整 app 字串換語言

### 決策 4 — 失敗處理：保持原狀 + toast

**決定：** PATCH 失敗時不改 UI（segmented 不變），顯示一次性 toast/snackbar。

**理由：** 語言切換不是關鍵操作，失敗就提醒使用者重試即可，不需要複雜的 retry / exponential backoff。

## Canonical keys

在 `i18n/canonical/zh-TW.json` 的 top-level 新增 `settings` namespace。完整結構如下：

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
      "confirmTitle": "清除空白卡片？",
      "confirmBody": "這會刪除所有還沒填標題的卡片，確定？"
    },
    "logout": {
      "button": "登出",
      "confirmTitle": "登出",
      "confirmBody": "確定要登出嗎？"
    }
  }
}
```

共約 25 個新 key。**「common.save/cancel/delete」已在 Phase 0-3 種子階段建立，不重複。**

- Web 使用 `useTranslations('settings')` + `t('language.zhTW')` 之類
- Mobile 使用 `AppL10n.of(context)!.settingsLanguageZhTW` 等（flatten.mjs 會把 `settings.language.zhTW` 轉成 `settingsLanguageZhTW`：每個 dot-path 段首字大寫，段內字母保留原樣）

**ICU placeholder：** 只有 `settings.account.joinedAt` 有 `{date}` 變數。Web 傳入 `format(parseISO(me.createdAt), 'yyyy/MM/dd')` 字串；Mobile 用 `DateFormat.yMd(intlLocaleTag(locale)).format(...)`。

## API 互動

現有 endpoint（Phase 0-3 已實作，不改動）：

- `PATCH /api/me/locale` 接 `{ locale: 'zh-TW' | 'en' | 'ja' | null }`，更新 DB + `NEXT_LOCALE` cookie
- `GET /api/me` 回傳含 `locale` 欄位
- Mobile 也透過 `/api/me/locale`（dio 呼叫）

## 檔案改動

### 修改

- `i18n/canonical/zh-TW.json` — 加 `settings` namespace
- `i18n/canonical/en.json` — 翻譯 settings 區塊（由對話式流程由 Claude 在實作時處理）
- `i18n/canonical/ja.json` — 同上
- `src/components/settings/settings-modal.tsx` — 全部字串改 `t(...)`, 加 `<LanguageSection>` + handler
- `mobile/lib/features/settings/settings_screen.dart` — 全部字串改 `AppL10n.of(context)!.xxx`, 加 `_LanguageSection` + handler

### 自動生成（跑 sync.mjs 和 gen-l10n 後）

- `src/messages/{zh-TW,en,ja}.json`
- `mobile/lib/l10n/app_{zh,en,ja}.arb`
- `mobile/lib/l10n/app_localizations*.dart`

## 測試策略

- **單元測試：** 不新增。Settings 頁的邏輯很薄，測試成本高於收益；既有 `locale_provider_test.dart`（Phase 0-3）已涵蓋 `LocaleNotifier` 的核心行為
- **型別檢查：** `next build` + `flutter analyze` 必須通過
- **i18n check：** `npm run i18n:check` 必須 `✅ In sync`（包含新 canonical 已被 transpile、無 pending）
- **手動驗證：** Plan 最後一個 task 是手動 QA checklist（web 開設定頁切三種語言 + 自動、mobile 同樣切四個選項、驗證 toast 在失敗情境秀出）

## 風險與未解問題

### 風險

- **Web live update 對 in-flight state 的影響：** 切 locale 會 replace URL，任何未 commit 的 form state / 未完成的 SWR 請求會被中斷。設定 modal 基本上沒有這類 state（只有 toggle），風險低
- **Mobile rebuild cost：** 切 locale 會讓整棵 widget tree rebuild，含 MaterialApp。用戶點一次的操作，可接受的 cost
- **`Accept-Language` fallback 的不確定性：** 切「自動」後 web 會 reload 到 `/`，middleware 依 browser header 決定，可能切到用戶預期外的語言（例如瀏覽器設英文但使用者以為「自動 = 原本的語言」）。這是預期行為，不 workaround

### 未解問題

- **Segmented control active 狀態判斷**：當 `user.locale = null`，要顯示「自動」為 active 還是當前渲染的語言為 active？
  - **決定：** 顯示「自動」active，避免使用者誤以為「auto 等於某個語言被鎖住」
- **Web settings-modal 是否要用 `NextIntlClientProvider`？**
  - Phase 0-3 已在 `[locale]/layout.tsx` 掛載，`useTranslations` 在任何 client component 都能直接用，不用額外包
- **Mobile 如果 PATCH 失敗、使用者重試一樣失敗，UI 卡在哪個狀態？**
  - **決定：** 保持 segmented 在原 locale active 狀態，每次失敗都秀一次 snackbar。不需要 retry UI

## 完成條件

Phase 4 plan 執行完成後，應達到：

- ✅ `i18n/canonical/zh-TW.json` 含 `settings.*` 25 個 key，en/ja 已翻譯
- ✅ `npm run i18n:check` 回 `✅ In sync`
- ✅ Web 設定頁切到 `/en/settings` 時，本體（除 TagManager）全部英文；切 `/ja/settings` 全部日文
- ✅ Web 點語言 segment 後 URL 自動變更，UI 立即切換，`user.locale` DB 寫入正確
- ✅ Web 點「自動」後 cookie 清除、URL 變成 Accept-Language 決定的 locale
- ✅ Mobile 設定頁切語言後，MaterialApp 立即 rebuild，字串全部換掉（除 TagManager）
- ✅ Mobile 切「自動」後 `localeProvider = null`、SharedPreferences 清除、畫面依系統語言渲染
- ✅ PATCH 失敗時顯示 toast/snackbar，segmented 不改動
- ✅ 已知限制：TagManager 內部字串在切英/日時仍為中文（文件記錄、待 Phase 5）

## 不做的事

- 不加入 language toggle 以外的設定（例如「日期格式」、「貨幣」、「週首日」等）— 那些留到後續 phase
- 不處理 TagManager 的 i18n — 明確延後
- 不實作 RTL 支援 — 支援的三種語言都是 LTR
- 不加 canonical 的 fallback 機制測試 — 已在 sync.mjs 用 zh-TW 做 fallback，Phase 0-3 已驗證
- 不為 i18n key 加 lint rule 防止硬編碼 — 延到 Phase 10

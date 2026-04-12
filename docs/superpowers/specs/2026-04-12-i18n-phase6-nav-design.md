# Phase 6 設計規格 — Sidebar / Bottom Nav i18n 遷移

**日期：** 2026-04-12
**前置：** Phase 0-5 已 merge。

## 目的

把 web 的 `AppSidebar` 和 mobile 的 `AppShell` 底部 nav bar 字串搬到 i18n canonical。順便統一中文用詞：web 目前硬寫英文 Tasks/Notes/Cards，切中文時會跟 mobile 的「行動 / 日誌 / 卡片」不一致。

## Scope

### 包含

- **Web：** `src/components/sidebar/app-sidebar.tsx`
  - nav label × 3（Tasks / Notes / Cards）
  - Settings button `title` 和 `aria-label`
  - Sidebar + bottom nav 的 `aria-label="主導覽"` ×2
- **Mobile：** `mobile/lib/shell/app_shell.dart`
  - NavigationBar 4 個 destination label（行動 / 日誌 / 卡片 / 設定）
- 新增 top-level `nav.*` canonical namespace（6 key）

### 不包含

- `SettingsModal`（Phase 4 已做）
- `TagManager` / `TagPicker` / `TagBadge`（Phase 5 已做）
- 所有 feature 頁面本體字串（cards / notes / day view / login / task detail / card detail）
- Bottom nav 的 icon 切換 / theme / 任何行為改動
- Drawer / hamburger menu（目前無）
- Notification badge 文案（尚未實作）

## 架構決策

### 決策 1 — 中文統一對齊 Mobile

**決定：** Web sidebar 切到中文介面時，nav label 用「行動 / 日誌 / 卡片 / 設定」（mobile 現有的詩意選字），而非「任務 / 筆記 / 卡片 / 設定」直譯。

**理由：**
- Mobile「行動」「日誌」是經設計的選字（比「任務」「筆記」貼產品調性），Web 應對齊
- 避免同 app 跨平台的同一個 nav 項目在中文介面出現兩種名字
- Web 英文本來就是 Tasks / Notes / Cards，保留不變

### 決策 2 — 日文用 Katakana 對齊中文語意

**決定：** 日文採 `アクション / ジャーナル / カード / 設定`，對齊中文的「行動 / 日誌 / 卡片 / 設定」語意層而非英文直譯（Tasks → タスク）。

**理由：**
- 保持中日共享「action / journal」語意的詩意連結
- 日文 UX 常用 katakana 做 nav label，不違和

### 決策 3 — Namespace：top-level `nav.*`

**決定：** 新增 top-level `nav` namespace，平行於 `common` / `settings` / `tags`。

**理由：**
- Nav label 跟 settings / tags / feature pages 的語義層級平行，不該巢狀在其他 namespace 下
- 未來若有 header / breadcrumb / subnav 也能歸在 `nav.*`

### 決策 4 — 無互動 / 行為改動

**決定：** Phase 6 純字串遷移。不改 nav 順序、不改 icon、不改 active state 判斷、不加 badge。

**理由：** Scope 最小，風險最低，用戶離線狀態可接受。

## Canonical keys

新增 6 個 key，全放 top-level `nav.*`：

### zh-TW.json

```json
{
  "nav": {
    "tasks": "行動",
    "notes": "日誌",
    "cards": "卡片",
    "settings": "設定",
    "mainNavAria": "主導覽",
    "settingsAria": "開啟設定"
  }
}
```

### en.json

```json
{
  "nav": {
    "tasks": "Tasks",
    "notes": "Notes",
    "cards": "Cards",
    "settings": "Settings",
    "mainNavAria": "Main navigation",
    "settingsAria": "Open settings"
  }
}
```

### ja.json

```json
{
  "nav": {
    "tasks": "アクション",
    "notes": "ジャーナル",
    "cards": "カード",
    "settings": "設定",
    "mainNavAria": "メインナビ",
    "settingsAria": "設定を開く"
  }
}
```

### Mobile getter 命名

- `AppL10n.navTasks` / `navNotes` / `navCards` / `navSettings` / `navMainNavAria` / `navSettingsAria`

### 不重用既有 key

- `settings.title` 也是「設定」但語義不同（那是 modal title，這是 nav label）。保留兩個 key 讓未來翻譯彈性獨立

## 字串對照表

### Web — `src/components/sidebar/app-sidebar.tsx`

| 位置 | 原字串 | canonical key |
|---|---|---|
| `navItems[0].label` | `"Tasks"` | `nav.tasks` |
| `navItems[1].label` | `"Notes"` | `nav.notes` |
| `navItems[2].label` | `"Cards"` | `nav.cards` |
| `SettingsButton` `title` | `"設定"` | `nav.settings` |
| `SettingsButton` `aria-label` | `"開啟設定"` | `nav.settingsAria` |
| `<aside> aria-label` | `"主導覽"` | `nav.mainNavAria` |
| `<nav> aria-label`（mobile 版） | `"主導覽"` | `nav.mainNavAria` |

**實作細節：** `navItems` 是 module-level const。`useTranslations` 是 hook，只能在 component 內叫。需要把 `navItems` 改成 component 內定義，或改成把 `label` 換成 `key: "tasks" | "notes" | "cards"` 讓 component 查表。採後者（較不動原本結構）。

### Mobile — `mobile/lib/shell/app_shell.dart`

| 位置 | 原字串 | canonical key |
|---|---|---|
| NavigationDestination 1 | `'行動'` | `nav.tasks` |
| NavigationDestination 2 | `'日誌'` | `nav.notes` |
| NavigationDestination 3 | `'卡片'` | `nav.cards` |
| NavigationDestination 4 | `'設定'` | `nav.settings` |

**實作細節：** `AppShell` 是 `StatelessWidget`，`build` 裡取 `final l = AppL10n.of(context)!;`，然後把 4 個 destination label 改成 `l.navTasks` 等。

## 檔案改動

### 修改

- `i18n/canonical/zh-TW.json` — 加 `nav` namespace
- `i18n/canonical/en.json` — 同上
- `i18n/canonical/ja.json` — 同上
- `src/components/sidebar/app-sidebar.tsx`
- `mobile/lib/shell/app_shell.dart`

### 自動生成

- `src/messages/{zh-TW,en,ja}.json`
- `mobile/lib/l10n/app_{zh,en,ja}.arb`
- `mobile/lib/l10n/app_localizations*.dart`

## 測試策略

- **型別檢查：** `npx next build` 通過、`flutter analyze` 無 issue
- **i18n check：** `npm run i18n:check` 回 `✅ In sync`
- **locale 單元測試：** `flutter test test/core/locale_provider_test.dart` 6/6
- **手動 QA（離線暫緩）：** Plan 最後一 task 列 checklist

## 風險與未解問題

### 風險

- **Web 切中文後 nav label 從英文變中文**：是期望的行為，但現有用戶看到會有短暫「變了」的感覺。不是 bug
- **`title` attribute 變中文 tooltip**：原本英文介面下 tooltip 也是英文，現在切中文時 tooltip 跟著切。正常行為

### 已解

- Namespace 放 top-level `nav.*`（非 `sidebar.*` 也非 `common.*`）
- 日文用 katakana 語意對齊中文（非英文直譯）
- 無 icon / 行為改動

## 完成條件

- ✅ `i18n/canonical/{zh-TW,en,ja}.json` 含 top-level `nav.*` 6 key
- ✅ `npm run i18n:check` 回 `✅ In sync`
- ✅ Web `app-sidebar.tsx` 無硬字串（code comment 除外）
- ✅ Mobile `app_shell.dart` 無硬字串（code comment 除外）
- ✅ `npx next build` 通過、`flutter analyze` 無 issue
- ✅ locale_provider test 仍 6/6

## 不做的事

- 不動 nav item 順序 / icon / href
- 不加 breadcrumb / subnav / notification badge
- 不動 feature 頁面本體字串（留給後續 phase）
- 不加新 UI

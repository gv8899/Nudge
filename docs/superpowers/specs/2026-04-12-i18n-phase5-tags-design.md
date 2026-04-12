# Phase 5 設計規格 — TagManager / TagPicker / TagBadge i18n 遷移

**日期：** 2026-04-12
**前置：** Phase 0-4 已 merge（i18n foundation + 設定頁 + 語言切換）。

## 目的

把 Phase 4 明確延後的共用標籤元件搬到 i18n canonical。完成後，切英/日時 TagManager（設定頁編輯清單）、TagPicker（加標籤下拉，卡片詳細頁也用）、TagBadge（aria-label）不再出現中文。

## Scope

### 包含

- **Web**：
  - `src/components/tags/tag-manager.tsx`
  - `src/components/tags/tag-picker.tsx`
  - `src/components/tags/tag-badge.tsx`
- **Mobile**：
  - `mobile/lib/features/tags/tag_manager.dart`
  - `mobile/lib/features/tags/tag_picker.dart`
- 新增 `tags` top-level canonical namespace（12 key）

### 不包含（延到後續 phase）

- **顏色顯示名稱**（灰藍 / 琥珀 / 橄欖 / 紫藤 / 赭紅 / 主色 / 藏青 / 天藍）
  - 理由：是 static metadata，跟 token 一起定義在 `src/lib/constants.ts` / `mobile/lib/features/tags/models.dart` 一個地方就夠；拉到 i18n 等於把顏色定義切兩處、新增顏色要同時改 constants + 3 個 canonical。長期要改隨時能做（純加法）
  - 表現缺陷：切英/日時 color picker tooltip 仍中文。已知、文件記錄、延後
- **`tag-color-picker.tsx`（web）/ `tag_color_picker.dart`（mobile）**：沒有自己的字串，純讀顏色 label，所以不動
- **Card detail / Task detail modal 自身的字串**：TagPicker 是被他們內嵌，但 host 元件本體留給下一個 phase
- **`models.dart` / `constants.ts` 的顏色定義**：同上

## 架構決策

### 決策 1 — Namespace：top-level `tags.*`（不放 `settings.tags` 下）

**決定：** 新增 canonical top-level `tags` namespace。

**理由：**
- TagPicker + TagBadge 用在 `card-detail.tsx` / `task-detail-modal.tsx`，不只 settings，放 `settings.tags.*` 底下語義錯
- Phase 4 的 `settings.tags.section` = "標籤管理" section heading，和這批 key 是不同語義層級，分開乾淨
- 未來如果要在非 settings 場景用同樣字串（例如加 "Delete tag" confirm dialog 到 cards kanban），從 top-level `tags.*` 引用更直覺

### 決策 2 — Mobile TagManager 內部標題重用 `settings.tags.section`

**決定：** `mobile/lib/features/tags/tag_manager.dart:37` 原本 hardcoded `Text('標籤管理')`，改成 `Text(l.settingsTagsSection)` 而不開新 key。

**理由：**
- 內容 100% 一致（繁中「標籤管理」/ EN "Tags" / JA「タグ」）
- 跨 namespace 存取 `AppL10n` 是 flat lookup，沒有技術成本
- 避免重複 key、避免 canonical drift（兩個 key 未來翻譯失衡）
- **副作用：** Mobile TagManager 只在 settings 場景被使用，所以重用 settings 命名沒語義衝突。若未來 TagManager 被搬到其他頁，再拆新 key

### 決策 3 — 共用 key 重用 `common.cancel` / `common.delete`

**決定：** 「取消」和「刪除」button 呼叫既有 `common.cancel` / `common.delete`（Phase 0-3 種子階段已存在）。

**理由：** DRY。這些是純通用短語，無 context 差異。

### 決策 4 — ICU placeholder 統一用 `{name}`

**決定：** 所有 tag 相關 placeholder 參數名用 `{name}`，不用 `{tagName}` / `{label}` 等變體。

**理由：** canonical 內一致性、transpile 後 Dart getter signature 一律 `(Object name)`、call site 讀起來統一。

### 決策 5 — 不加 loading / disabled 狀態

**決定：** TagManager 的 create / delete / update async 操作保持原本無 loading state 的行為。

**理由：** Phase 5 scope 是純字串遷移，不改行為。既有 UX 可接受（操作快、錯誤沉默），改善留下一輪。

## Canonical keys

新增 12 個 key，全放 top-level `tags.*`：

```json
{
  "tags": {
    "add": "新增",
    "addTag": "新增標籤",
    "addTagShort": "加標籤",
    "changeColor": "換色",
    "create": "建立",
    "createNamed": "建立「{name}」",
    "deleteTitle": "刪除標籤",
    "deleteConfirm": "確定要刪除「{name}」嗎？",
    "deleteTagAria": "刪除 {name}",
    "newTagPlaceholder": "新增標籤...",
    "removeAria": "移除 {name}",
    "searchOrCreate": "搜尋或建立標籤..."
  }
}
```

### en.json 對應

```json
{
  "tags": {
    "add": "Add",
    "addTag": "Add tag",
    "addTagShort": "Add tag",
    "changeColor": "Color",
    "create": "Create",
    "createNamed": "Create \"{name}\"",
    "deleteTitle": "Delete tag",
    "deleteConfirm": "Delete \"{name}\"?",
    "deleteTagAria": "Delete {name}",
    "newTagPlaceholder": "New tag...",
    "removeAria": "Remove {name}",
    "searchOrCreate": "Search or create tag..."
  }
}
```

### ja.json 對應

```json
{
  "tags": {
    "add": "追加",
    "addTag": "タグ追加",
    "addTagShort": "タグ追加",
    "changeColor": "色",
    "create": "作成",
    "createNamed": "「{name}」を作成",
    "deleteTitle": "タグを削除",
    "deleteConfirm": "「{name}」を削除しますか？",
    "deleteTagAria": "{name} を削除",
    "newTagPlaceholder": "新しいタグ...",
    "removeAria": "{name} を外す",
    "searchOrCreate": "タグを検索・作成..."
  }
}
```

### 重用

- `common.cancel` / `common.delete`（Phase 0-3 種子已存在）
- `settings.tags.section`（Phase 4，mobile TagManager 內部 title）

### Mobile getter 命名（flatten.mjs 規則）

Canonical `tags.createNamed` → ARB `tagsCreateNamed` → Dart `AppL10n.tagsCreateNamed(Object name)`（因為有 `{name}` placeholder）。

無 placeholder 的 key 是純 `String` getter：`AppL10n.tagsAdd`、`AppL10n.tagsChangeColor` 等。

## 檔案改動

### 修改

- `i18n/canonical/zh-TW.json` — 加 `tags` namespace
- `i18n/canonical/en.json` — 同上
- `i18n/canonical/ja.json` — 同上
- `src/components/tags/tag-manager.tsx` — 4 string
- `src/components/tags/tag-picker.tsx` — 7 string
- `src/components/tags/tag-badge.tsx` — 1 aria-label
- `mobile/lib/features/tags/tag_manager.dart` — 6 string（含 title 重用 `settings.tags.section`）
- `mobile/lib/features/tags/tag_picker.dart` — 5 string

### 自動生成

- `src/messages/{zh-TW,en,ja}.json`
- `mobile/lib/l10n/app_{zh,en,ja}.arb`
- `mobile/lib/l10n/app_localizations*.dart`

## 字串對照表

### Web

| 檔案 | 原字串 | canonical key |
|---|---|---|
| `tag-manager.tsx:63` | `aria-label="換色"` | `tags.changeColor` |
| `tag-manager.tsx:105` | `aria-label={`刪除 ${tag.name}`}` | `tags.deleteTagAria` with `{name: tag.name}` |
| `tag-manager.tsx:121` | `placeholder="新增標籤..."` | `tags.newTagPlaceholder` |
| `tag-manager.tsx:130` | button text `新增` | `tags.add` |
| `tag-picker.tsx:74` | `aria-label="新增標籤"` | `tags.addTag` |
| `tag-picker.tsx:77` | `{selectedTags.length === 0 ? "加標籤" : "+"}` | `tags.addTagShort`（只改 "加標籤"，"+" 保留） |
| `tag-picker.tsx:83` | `建立「{creatingName}」` | `tags.createNamed` with `{name: creatingName}` |
| `tag-picker.tsx:92` | button `取消` | `common.cancel` |
| `tag-picker.tsx:99` | button `建立` | `tags.create` |
| `tag-picker.tsx:110` | `placeholder="搜尋或建立標籤..."` | `tags.searchOrCreate` |
| `tag-picker.tsx:140` | `建立「{search.trim()}」` | `tags.createNamed` with `{name: search.trim()}` |
| `tag-badge.tsx:28` | `aria-label={`移除 ${name}`}` | `tags.removeAria` with `{name}` |

### Mobile

| 檔案 | 原字串 | canonical key |
|---|---|---|
| `tag_manager.dart:37` | `Text('標籤管理', ...)` | `l.settingsTagsSection`（重用 Phase 4 key） |
| `tag_manager.dart:116` | `hintText: '新增標籤...'` | `l.tagsNewTagPlaceholder` |
| `tag_manager.dart:165` | dialog title `'刪除標籤'` | `l.tagsDeleteTitle` |
| `tag_manager.dart:166` | `'確定要刪除「${tag.name}」嗎？'` | `l.tagsDeleteConfirm(tag.name)` |
| `tag_manager.dart:171` | button `'取消'` | `l.commonCancel` |
| `tag_manager.dart:179` | button `'刪除'` | `l.commonDelete` |
| `tag_picker.dart:83` | `hintText: '搜尋或建立標籤...'` | `l.tagsSearchOrCreate` |
| `tag_picker.dart:95` | `'建立「${_searchController.text.trim()}」'` | `l.tagsCreateNamed(_searchController.text.trim())` |
| `tag_picker.dart:108` | button `'取消'` | `l.commonCancel` |
| `tag_picker.dart:112` | button `'建立'` | `l.tagsCreate` |
| `tag_picker.dart:149` | `title: Text('建立「${_search.trim()}」')` | `l.tagsCreateNamed(_search.trim())` |

### 無新增 UI

Phase 5 不加任何新元件、不加 language toggle 以外的設定、不加 loading state。純字串搬家。

## 測試策略

- **型別檢查：** `npx next build` 無錯、`flutter analyze` 無 issue
- **i18n check：** `npm run i18n:check` 回 `✅ In sync`
- **locale 單元測試：** `flutter test test/core/locale_provider_test.dart` 仍 6/6 pass（未觸及 provider，理應不受影響）
- **手動 QA：** Plan 最後一 task 列出 checklist（web 切 en/ja 打開 settings + 卡片詳細頁的 TagPicker、mobile 同樣）

## 風險與未解問題

### 風險

- **Card detail / task detail 仍中文**：TagPicker 被這兩個元件內嵌，切英/日時會出現「card 本體中文 + picker 英文」的混合狀態。這是 Phase 5 明確取捨，不是 bug
- **Mobile TagManager 重用 `settings.tags.section`**：若未來 TagManager 被從 settings 抽離放到別處（例如獨立 /tags 頁），這個重用會變奇怪。接受此技術債，未來真的搬時再拆 key

### 已解

- **Namespace 是否放 `settings.tags.*` 底下**？→ 不，因為 TagPicker/TagBadge 跨 settings 邊界，top-level `tags.*` 更對
- **顏色名稱是否一起做**？→ 不做，保持 static metadata 特性
- **是否同時改 card detail 的字串**？→ 不，scope creep

## 完成條件

- ✅ `i18n/canonical/{zh-TW,en,ja}.json` 含 `tags.*` 12 key
- ✅ `npm run i18n:check` 回 `✅ In sync`
- ✅ Web `tag-manager.tsx` / `tag-picker.tsx` / `tag-badge.tsx` 無中文硬字串（code comment 除外）
- ✅ Mobile `tag_manager.dart` / `tag_picker.dart` 無中文硬字串（code comment 除外）
- ✅ `npx next build` 通過、`flutter analyze` 無 issue
- ✅ 既有 locale_provider test 仍 6/6 pass
- ✅ 已知限制：顏色名稱在 color picker tooltip 仍中文，文件記錄待後續

## 不做的事

- 不動顏色顯示名稱
- 不動 `tag-color-picker.tsx` / `tag_color_picker.dart`
- 不動 `card-detail.tsx` / `task-detail-modal.tsx` 本體字串
- 不加任何新 UI feature
- 不加 loading / disabled 狀態
- 不重構 TagColor struct / constants

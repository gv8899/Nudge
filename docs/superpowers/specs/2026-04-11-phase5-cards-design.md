# Phase 5：卡片系統設計

## 摘要

在 Flutter App 實作卡片系統，對應 Web 的 `/cards` 頁面。包含 List + Grid 兩種 view、搜尋、Tag 系統（picker + 管理）、卡片詳細頁（title + description 編輯 + tag）、設定頁 tag 管理。不做 Kanban（手機體驗不好）。

## 設計決策

| 項目 | 決定 | 理由 |
|------|------|------|
| View 模式 | List + Grid（不做 Kanban） | 手機螢幕小，Kanban 體驗差 |
| 詳細頁 | 全螢幕 Push | 和任務詳細頁一致 |
| Description | 純文字 TextField + 自動儲存 | 富文本留 Phase 4 |
| Tag picker | Bottom Sheet | 手機自然操作 |
| 無限捲動 | 先不做，一次載入 | YAGNI，量大再加 |

## 畫面結構

### CardsScreen（主畫面）

```
┌──────────────────────────────┐
│ 卡片        [+]  [≡] [⊞]   │  ← 標題 + 新增 + view 切換
├──────────────────────────────┤
│ 🔍 搜尋卡片...               │  ← 搜尋框
├──────────────────────────────┤
│ List view:                   │
│ ┌────────────────────────┐   │
│ │ 任務標題          4/10 │   │
│ │ 預覽文字...            │   │
│ │ [tag1] [tag2]          │   │
│ └────────────────────────┘   │
│ ┌────────────────────────┐   │
│ │ ...                    │   │
│ └────────────────────────┘   │
│                              │
│ Grid view:                   │
│ ┌──────┐ ┌──────┐           │
│ │title │ │title │           │
│ │prev..│ │prev..│           │
│ │[tag] │ │[tag] │           │
│ │ 4/10 │ │ 4/10 │           │
│ └──────┘ └──────┘           │
└──────────────────────────────┘
```

### CardDetailScreen（全螢幕 push）

```
┌──────────────────────────────┐
│ ← 返回                      │
├──────────────────────────────┤
│ 卡片標題（TextField）        │
│ ─────────────────            │
│ [tag1] [tag2] [+ 加標籤]    │
├──────────────────────────────┤
│ 描述內容（TextField）        │
│ 自動儲存...                  │
│                              │
│                              │
├──────────────────────────────┤
│ 建立 2026/04/10 · 更新 04/11│
└──────────────────────────────┘
```

### Tag Picker（Bottom Sheet）

```
┌──────────────────────────────┐
│ 搜尋或建立標籤...            │
├──────────────────────────────┤
│ ● 產品想法              ✓   │
│ ● 技術筆記                  │
│ ● 會議記錄              ✓   │
│ + 建立「xxx」                │
└──────────────────────────────┘
```

### Tag Manager（設定頁 section）

```
┌──────────────────────────────┐
│ 標籤管理                     │
├──────────────────────────────┤
│ ● 產品想法               🗑  │
│ ● 技術筆記               🗑  │
│ [新增標籤...]                │
└──────────────────────────────┘
```

## 元件拆分

```
mobile/lib/features/cards/
├── cards_screen.dart          — 主畫面（搜尋 + view 切換 + 列表）
├── cards_provider.dart        — Riverpod：卡片列表 + 搜尋
├── card_list_item.dart        — List view 單張卡片
├── card_grid_item.dart        — Grid view 單張卡片
├── card_detail_screen.dart    — 全螢幕詳細頁

mobile/lib/features/tags/
├── tags_provider.dart         — Riverpod：tag CRUD
├── tag_badge.dart             — Tag 小標籤顯示
├── tag_picker.dart            — Tag 選取 bottom sheet
├── tag_color_picker.dart      — 色盤選擇

mobile/lib/features/settings/
├── settings_screen.dart       — 加入 tag 管理 section（修改）
├── tag_manager.dart           — Tag 列表管理
```

## Data Models

### CardItem（新增到 models 或獨立檔案）

```dart
class CardItem {
  final String id;
  final String title;
  final String description;
  final String status;
  final String createdAt;
  final String updatedAt;
  final String? completedAt;
  final List<TagItem> tags;
}

class TagItem {
  final String id;
  final String name;
  final String color;
}
```

### Tag（完整版）

```dart
class Tag {
  final String id;
  final String name;
  final String color;
  final int sortOrder;
}
```

## Riverpod Providers

### `cardsProvider`

```dart
// 以搜尋 query 為參數
final cardsProvider = FutureProvider.family<List<CardItem>, String>((ref, query) async {
  final apiClient = ref.read(apiClientProvider);
  final params = query.isNotEmpty ? '?q=$query&limit=50' : '?limit=50';
  final response = await apiClient.dio.get('/api/cards$params');
  return (response.data['cards'] as List)
      .map((e) => CardItem.fromJson(e))
      .toList();
});
```

### `tagsProvider`

```dart
final tagsProvider = FutureProvider<List<Tag>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.dio.get('/api/tags');
  return (response.data['tags'] as List)
      .map((e) => Tag.fromJson(e))
      .toList();
});
```

### `tagActionsProvider`

```dart
class TagActions {
  Future<Tag> create(String name, String color);
  Future<void> update(String id, {String? name, String? color});
  Future<void> delete(String id);
  Future<void> setTaskTags(String taskId, List<String> tagIds);
}
```

## API 對接

| 操作 | Endpoint | Method | Body/Params |
|------|----------|--------|-------------|
| 卡片列表 | `/api/cards` | GET | `?q=&cursor=&limit=50` |
| 建立卡片 | `/api/tasks` | POST | `{ title: "", description: "<p></p>", status: "inbox" }` |
| 卡片詳情 | `/api/tasks/{id}` | GET | — |
| 更新卡片 | `/api/tasks/{id}` | PATCH | `{ title?, description? }` |
| Tag 列表 | `/api/tags` | GET | — |
| 新增 Tag | `/api/tags` | POST | `{ name, color? }` |
| 更新 Tag | `/api/tags/{id}` | PATCH | `{ name?, color? }` |
| 刪除 Tag | `/api/tags/{id}` | DELETE | — |
| 設定 Tag | `/api/tasks/{id}/tags` | PUT | `{ tagIds: [...] }` |

## Tag 色盤

和 Web `TAG_COLORS` 一致，在 `AppColors` 加入或獨立定義：

```dart
static const tagColors = [
  ('chart-1', '灰藍', Color(0xFF5A6B7C)),  // dark mode values
  ('chart-2', '琥珀', Color(0xFFC89968)),
  ('chart-3', '橄欖', Color(0xFF8AA57D)),
  ('chart-4', '紫藤', Color(0xFFA78AAF)),
  ('chart-5', '赭紅', Color(0xFFB56B5A)),
  ('primary', '主色', Color(0xFFD4A574)),
  ('status-waiting', '藏青', Color(0xFF9A7B4F)),
  ('status-in-progress', '天藍', Color(0xFF5A9BC5)),
];
```

Tag badge 的渲染：背景色用 `color.withOpacity(0.15)`，文字色用 `color`。

## View 切換

- 偏好存在本地（SharedPreferences 或 simple state）
- 預設 grid view
- 兩個 icon toggle（和 Web 一樣的 List / Grid icon）

## 搜尋

- TextField + 300ms debounce
- 改變 query → invalidate cardsProvider
- 空字串 = 顯示全部

## 路由

在 `app.dart` 的 cards branch 加入：

```dart
StatefulShellBranch(
  routes: [
    GoRoute(
      path: '/cards',
      builder: (context, state) => const CardsScreen(),
      routes: [
        GoRoute(
          path: ':id',
          builder: (context, state) => CardDetailScreen(
            cardId: state.pathParameters['id']!,
          ),
        ),
      ],
    ),
  ],
),
```

## 不做

- Kanban view
- 無限捲動（一次載入 50 張）
- 清除空白卡片功能
- Description 富文本（純文字 TextField）
- Tag 拖曳排序（settings 裡的 sortOrder）

## 完成標準

- [ ] List / Grid view 切換正常
- [ ] 搜尋即時過濾（300ms debounce）
- [ ] 新增卡片 → 建立空白 → 進詳細頁
- [ ] 詳細頁 title 可編輯（submit 儲存）
- [ ] 詳細頁 description 純文字可編輯（800ms 自動儲存）
- [ ] 詳細頁顯示 tag badges + tag picker
- [ ] Tag picker：bottom sheet，搜尋、多選、新增（含選色）
- [ ] Tag badge 在 list/grid item 上顯示
- [ ] 設定頁 tag 管理：新增、改名、換色、刪除
- [ ] 返回列表時資料刷新
- [ ] 資料和 Web 同步

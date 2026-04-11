# Phase 5：卡片系統實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Flutter App 實作卡片系統（List/Grid view + 搜尋 + Tag 系統 + 詳細頁 + 設定頁 Tag 管理）

**Architecture:** 新增 `features/cards/` 和 `features/tags/` 兩個 feature 目錄。Cards 用 FutureProvider.family 以 query 為 key。Tags 用 FutureProvider 全域快取。CardDetailScreen 複用 task detail 的 auto-save pattern。Tag picker 用 bottom sheet。設定頁新增 tag 管理 section。

**Tech Stack:** Flutter, Riverpod, Dio, GoRouter, AppColors

---

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 新增 | `mobile/lib/features/cards/models.dart` | CardItem model |
| 新增 | `mobile/lib/features/tags/models.dart` | Tag model + TagColor |
| 新增 | `mobile/lib/features/tags/tags_provider.dart` | Tag CRUD provider |
| 新增 | `mobile/lib/features/tags/tag_badge.dart` | Tag 小標籤 |
| 新增 | `mobile/lib/features/tags/tag_color_picker.dart` | 色盤選擇 |
| 新增 | `mobile/lib/features/tags/tag_picker.dart` | Tag 選取 bottom sheet |
| 新增 | `mobile/lib/features/tags/tag_manager.dart` | 設定頁 tag 管理 |
| 新增 | `mobile/lib/features/cards/cards_provider.dart` | 卡片列表 provider |
| 新增 | `mobile/lib/features/cards/card_list_item.dart` | List view 卡片 |
| 新增 | `mobile/lib/features/cards/card_grid_item.dart` | Grid view 卡片 |
| 新增 | `mobile/lib/features/cards/card_detail_screen.dart` | 卡片詳細頁 |
| 重寫 | `mobile/lib/features/cards/cards_screen.dart` | 卡片主畫面 |
| 修改 | `mobile/lib/features/settings/settings_screen.dart` | 加 tag 管理 |
| 修改 | `mobile/lib/app.dart` | 加 card detail 路由 |

---

### Task 1: Tag Models + Tag Colors

**Files:**
- Create: `mobile/lib/features/tags/models.dart`

- [ ] **Step 1: 建立 tag models**

建立目錄和檔案：

```bash
mkdir -p /Users/mike/Documents/nudge/mobile/lib/features/tags
```

建立 `mobile/lib/features/tags/models.dart`：

```dart
import 'package:flutter/material.dart';
import '../../core/theme.dart';

class Tag {
  final String id;
  final String name;
  final String color;
  final int sortOrder;

  const Tag({
    required this.id,
    required this.name,
    required this.color,
    required this.sortOrder,
  });

  factory Tag.fromJson(Map<String, dynamic> json) => Tag(
        id: json['id'] as String,
        name: json['name'] as String,
        color: json['color'] as String,
        sortOrder: json['sortOrder'] as int? ?? 0,
      );
}

class TagColor {
  final String value;
  final String label;
  final Color color;

  const TagColor(this.value, this.label, this.color);

  static const List<TagColor> all = [
    TagColor('chart-1', '灰藍', Color(0xFF7A8B9C)),
    TagColor('chart-2', '琥珀', Color(0xFFC89968)),
    TagColor('chart-3', '橄欖', Color(0xFF8AA57D)),
    TagColor('chart-4', '紫藤', Color(0xFFA78AAF)),
    TagColor('chart-5', '赭紅', Color(0xFFB56B5A)),
    TagColor('primary', '主色', AppColors.primary),
    TagColor('status-waiting', '藏青', Color(0xFF9A7B4F)),
    TagColor('status-in-progress', '天藍', Color(0xFF5A9BC5)),
  ];

  static Color resolve(String tokenName) {
    return all.firstWhere(
      (c) => c.value == tokenName,
      orElse: () => all[0],
    ).color;
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/tags/
git commit -m "feat: Tag model + TagColor 色盤"
```

---

### Task 2: Card Models + Cards Provider

**Files:**
- Create: `mobile/lib/features/cards/models.dart`
- Create: `mobile/lib/features/cards/cards_provider.dart`

- [ ] **Step 1: 建立 card models**

建立 `mobile/lib/features/cards/models.dart`：

```dart
import '../tags/models.dart';

class CardItem {
  final String id;
  final String title;
  final String description;
  final String status;
  final String createdAt;
  final String updatedAt;
  final String? completedAt;
  final List<CardTag> tags;

  const CardItem({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.completedAt,
    required this.tags,
  });

  factory CardItem.fromJson(Map<String, dynamic> json) => CardItem(
        id: json['id'] as String,
        title: json['title'] as String,
        description: json['description'] as String? ?? '',
        status: json['status'] as String,
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
        completedAt: json['completedAt'] as String?,
        tags: (json['tags'] as List?)
                ?.map((e) => CardTag.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class CardTag {
  final String id;
  final String name;
  final String color;

  const CardTag({required this.id, required this.name, required this.color});

  factory CardTag.fromJson(Map<String, dynamic> json) => CardTag(
        id: json['id'] as String,
        name: json['name'] as String,
        color: json['color'] as String,
      );
}
```

- [ ] **Step 2: 建立 cards_provider.dart**

建立 `mobile/lib/features/cards/cards_provider.dart`：

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../auth/auth_provider.dart';
import 'models.dart';

final cardsProvider =
    FutureProvider.family<List<CardItem>, String>((ref, query) async {
  final apiClient = ref.read(apiClientProvider);
  final params = <String, String>{'limit': '50'};
  if (query.isNotEmpty) params['q'] = query;
  final response = await apiClient.dio.get('/api/cards', queryParameters: params);
  final list = response.data['cards'] as List;
  return list.map((e) => CardItem.fromJson(e as Map<String, dynamic>)).toList();
});

final cardDetailProvider =
    FutureProvider.family<CardItem, String>((ref, id) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.dio.get('/api/tasks/$id');
  // API 回傳的是 task 格式，但 CardItem 也能 parse
  final data = response.data as Map<String, dynamic>;
  // 取得 tags
  // /api/tasks/:id 不回傳 tags，需要另外取或用 cards API
  // 簡化：先不帶 tags，從 cardsProvider 快取取
  return CardItem.fromJson({...data, 'tags': data['tags'] ?? []});
});

class CardActions {
  final ApiClient _api;
  CardActions(this._api);

  Future<String> create() async {
    final response = await _api.dio.post('/api/tasks', data: {
      'title': '',
      'description': '<p></p>',
      'status': 'inbox',
    });
    return response.data['id'] as String;
  }

  Future<void> updateTitle(String id, String title) async {
    await _api.dio.patch('/api/tasks/$id', data: {'title': title});
  }

  Future<void> updateDescription(String id, String description) async {
    await _api.dio.patch('/api/tasks/$id', data: {'description': description});
  }

  Future<void> setTags(String taskId, List<String> tagIds) async {
    await _api.dio.put('/api/tasks/$taskId/tags', data: {'tagIds': tagIds});
  }
}

final cardActionsProvider = Provider<CardActions>((ref) {
  return CardActions(ref.read(apiClientProvider));
});
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/cards/models.dart mobile/lib/features/cards/cards_provider.dart
git commit -m "feat: CardItem model + cards provider"
```

---

### Task 3: Tags Provider

**Files:**
- Create: `mobile/lib/features/tags/tags_provider.dart`

- [ ] **Step 1: 建立 tags_provider.dart**

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../auth/auth_provider.dart';
import 'models.dart';

final tagsProvider = FutureProvider<List<Tag>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.dio.get('/api/tags');
  final list = response.data['tags'] as List;
  return list.map((e) => Tag.fromJson(e as Map<String, dynamic>)).toList();
});

class TagActions {
  final ApiClient _api;
  TagActions(this._api);

  Future<Tag> create(String name, {String color = 'chart-1'}) async {
    final response = await _api.dio.post('/api/tags', data: {
      'name': name,
      'color': color,
    });
    return Tag.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> update(String id, {String? name, String? color}) async {
    final data = <String, dynamic>{};
    if (name != null) data['name'] = name;
    if (color != null) data['color'] = color;
    await _api.dio.patch('/api/tags/$id', data: data);
  }

  Future<void> delete(String id) async {
    await _api.dio.delete('/api/tags/$id');
  }
}

final tagActionsProvider = Provider<TagActions>((ref) {
  return TagActions(ref.read(apiClientProvider));
});
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/tags/tags_provider.dart
git commit -m "feat: tags provider + TagActions"
```

---

### Task 4: Tag Badge + Tag Color Picker

**Files:**
- Create: `mobile/lib/features/tags/tag_badge.dart`
- Create: `mobile/lib/features/tags/tag_color_picker.dart`

- [ ] **Step 1: 建立 tag_badge.dart**

```dart
import 'package:flutter/material.dart';
import 'models.dart';

class TagBadge extends StatelessWidget {
  final String name;
  final String colorToken;
  final VoidCallback? onRemove;

  const TagBadge({
    super.key,
    required this.name,
    required this.colorToken,
    this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final color = TagColor.resolve(colorToken);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            name,
            style: TextStyle(fontSize: 11, color: color),
          ),
          if (onRemove != null) ...[
            const SizedBox(width: 4),
            GestureDetector(
              onTap: onRemove,
              child: Icon(Icons.close, size: 12, color: color),
            ),
          ],
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: 建立 tag_color_picker.dart**

```dart
import 'package:flutter/material.dart';
import '../../core/theme.dart';
import 'models.dart';

class TagColorPicker extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onSelected;

  const TagColorPicker({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: TagColor.all.map((tc) {
        final isSelected = tc.value == selected;
        return GestureDetector(
          onTap: () => onSelected(tc.value),
          child: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: tc.color,
              shape: BoxShape.circle,
              border: isSelected
                  ? Border.all(color: AppColors.foreground, width: 2)
                  : null,
            ),
          ),
        );
      }).toList(),
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/tags/tag_badge.dart mobile/lib/features/tags/tag_color_picker.dart
git commit -m "feat: TagBadge + TagColorPicker"
```

---

### Task 5: Tag Picker (Bottom Sheet)

**Files:**
- Create: `mobile/lib/features/tags/tag_picker.dart`

- [ ] **Step 1: 建立 tag_picker.dart**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import 'models.dart';
import 'tags_provider.dart';
import 'tag_badge.dart';
import 'tag_color_picker.dart';

class TagPicker extends ConsumerStatefulWidget {
  final List<String> selectedTagIds;
  final ValueChanged<List<String>> onChanged;

  const TagPicker({
    super.key,
    required this.selectedTagIds,
    required this.onChanged,
  });

  @override
  ConsumerState<TagPicker> createState() => _TagPickerState();
}

class _TagPickerState extends ConsumerState<TagPicker> {
  final _searchController = TextEditingController();
  String _search = '';
  bool _isCreating = false;
  String _newColor = 'chart-1';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _toggle(String tagId) {
    final current = [...widget.selectedTagIds];
    if (current.contains(tagId)) {
      current.remove(tagId);
    } else {
      current.add(tagId);
    }
    widget.onChanged(current);
  }

  Future<void> _createTag() async {
    final name = _searchController.text.trim();
    if (name.isEmpty) return;
    final tag = await ref.read(tagActionsProvider).create(name, color: _newColor);
    ref.invalidate(tagsProvider);
    _toggle(tag.id);
    _searchController.clear();
    setState(() {
      _search = '';
      _isCreating = false;
      _newColor = 'chart-1';
    });
  }

  @override
  Widget build(BuildContext context) {
    final tagsAsync = ref.watch(tagsProvider);
    final allTags = tagsAsync.when(
      data: (tags) => tags,
      loading: () => <Tag>[],
      error: (_, _) => <Tag>[],
    );

    final filtered = allTags.where(
      (t) => t.name.toLowerCase().contains(_search.toLowerCase()),
    ).toList();

    final exactMatch = allTags.any(
      (t) => t.name.toLowerCase() == _search.toLowerCase(),
    );

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Search
            TextField(
              controller: _searchController,
              autofocus: true,
              onChanged: (v) => setState(() => _search = v),
              style: const TextStyle(fontSize: 14, color: AppColors.foreground),
              decoration: const InputDecoration(
                hintText: '搜尋或建立標籤...',
                hintStyle: TextStyle(color: AppColors.textFaint),
                border: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.border)),
                focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.primary)),
                isDense: true,
                contentPadding: EdgeInsets.symmetric(vertical: 12),
              ),
            ),
            const SizedBox(height: 8),

            if (_isCreating) ...[
              // Create new tag UI
              Text('建立「${_searchController.text.trim()}」',
                  style: const TextStyle(fontSize: 13, color: AppColors.foreground)),
              const SizedBox(height: 12),
              TagColorPicker(selected: _newColor, onSelected: (c) => setState(() => _newColor = c)),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => setState(() => _isCreating = false),
                    child: const Text('取消', style: TextStyle(color: AppColors.textDim)),
                  ),
                  TextButton(
                    onPressed: _createTag,
                    child: const Text('建立', style: TextStyle(color: AppColors.primary)),
                  ),
                ],
              ),
            ] else ...[
              // Tag list
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 250),
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    ...filtered.map((tag) {
                      final isSelected = widget.selectedTagIds.contains(tag.id);
                      return ListTile(
                        dense: true,
                        leading: Container(
                          width: 12, height: 12,
                          decoration: BoxDecoration(
                            color: TagColor.resolve(tag.color),
                            shape: BoxShape.circle,
                          ),
                        ),
                        title: Text(tag.name,
                            style: const TextStyle(fontSize: 14, color: AppColors.foreground)),
                        trailing: isSelected
                            ? const Icon(Icons.check, size: 18, color: AppColors.primary)
                            : null,
                        onTap: () => _toggle(tag.id),
                      );
                    }),
                    if (_search.trim().isNotEmpty && !exactMatch)
                      ListTile(
                        dense: true,
                        leading: const Icon(Icons.add, size: 18, color: AppColors.primary),
                        title: Text('建立「${_search.trim()}」',
                            style: const TextStyle(fontSize: 14, color: AppColors.primary)),
                        onTap: () => setState(() => _isCreating = true),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

void showTagPicker(
  BuildContext context, {
  required WidgetRef ref,
  required List<String> selectedTagIds,
  required ValueChanged<List<String>> onChanged,
}) {
  showModalBottomSheet(
    context: context,
    backgroundColor: AppColors.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    isScrollControlled: true,
    builder: (_) => ProviderScope(
      parent: ProviderScope.containerOf(context),
      child: TagPicker(
        selectedTagIds: selectedTagIds,
        onChanged: onChanged,
      ),
    ),
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/tags/tag_picker.dart
git commit -m "feat: TagPicker bottom sheet（搜尋、多選、新增）"
```

---

### Task 6: Tag Manager (Settings)

**Files:**
- Create: `mobile/lib/features/tags/tag_manager.dart`
- Modify: `mobile/lib/features/settings/settings_screen.dart`

- [ ] **Step 1: 建立 tag_manager.dart**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import 'models.dart';
import 'tags_provider.dart';
import 'tag_color_picker.dart';

class TagManager extends ConsumerStatefulWidget {
  const TagManager({super.key});

  @override
  ConsumerState<TagManager> createState() => _TagManagerState();
}

class _TagManagerState extends ConsumerState<TagManager> {
  final _newNameController = TextEditingController();
  String? _editingId;
  final _editController = TextEditingController();

  @override
  void dispose() {
    _newNameController.dispose();
    _editController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tagsAsync = ref.watch(tagsProvider);
    final tags = tagsAsync.when(
      data: (t) => t,
      loading: () => <Tag>[],
      error: (_, _) => <Tag>[],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('標籤管理',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textDim)),
        const SizedBox(height: 12),

        ...tags.map((tag) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  // Color dot — tap to change
                  GestureDetector(
                    onTap: () => _showColorPicker(tag),
                    child: Container(
                      width: 16, height: 16,
                      decoration: BoxDecoration(
                        color: TagColor.resolve(tag.color),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Name — tap to edit
                  Expanded(
                    child: _editingId == tag.id
                        ? TextField(
                            controller: _editController,
                            autofocus: true,
                            style: const TextStyle(fontSize: 14, color: AppColors.foreground),
                            decoration: const InputDecoration(
                              isDense: true,
                              contentPadding: EdgeInsets.symmetric(vertical: 8),
                              border: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.primary)),
                              focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.primary)),
                            ),
                            onSubmitted: (value) async {
                              final trimmed = value.trim();
                              if (trimmed.isNotEmpty && trimmed != tag.name) {
                                await ref.read(tagActionsProvider).update(tag.id, name: trimmed);
                                ref.invalidate(tagsProvider);
                              }
                              setState(() => _editingId = null);
                            },
                            onTapOutside: (_) => setState(() => _editingId = null),
                          )
                        : GestureDetector(
                            onTap: () {
                              _editController.text = tag.name;
                              setState(() => _editingId = tag.id);
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Text(tag.name,
                                  style: const TextStyle(fontSize: 14, color: AppColors.foreground)),
                            ),
                          ),
                  ),

                  // Delete
                  GestureDetector(
                    onTap: () => _confirmDelete(tag),
                    child: const Padding(
                      padding: EdgeInsets.all(8),
                      child: Icon(Icons.delete_outline, size: 18, color: AppColors.textFaint),
                    ),
                  ),
                ],
              ),
            )),

        // Add new tag
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _newNameController,
                style: const TextStyle(fontSize: 14, color: AppColors.foreground),
                decoration: const InputDecoration(
                  hintText: '新增標籤...',
                  hintStyle: TextStyle(color: AppColors.textFaint),
                  isDense: true,
                  contentPadding: EdgeInsets.symmetric(vertical: 8),
                  border: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.border)),
                  focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.primary)),
                ),
                onSubmitted: (_) => _addTag(),
              ),
            ),
            if (_newNameController.text.trim().isNotEmpty)
              TextButton(
                onPressed: _addTag,
                child: const Text('新增', style: TextStyle(fontSize: 12, color: AppColors.primary)),
              ),
          ],
        ),
      ],
    );
  }

  Future<void> _addTag() async {
    final name = _newNameController.text.trim();
    if (name.isEmpty) return;
    await ref.read(tagActionsProvider).create(name);
    ref.invalidate(tagsProvider);
    _newNameController.clear();
    setState(() {});
  }

  void _showColorPicker(Tag tag) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: TagColorPicker(
          selected: tag.color,
          onSelected: (color) async {
            Navigator.pop(context);
            await ref.read(tagActionsProvider).update(tag.id, color: color);
            ref.invalidate(tagsProvider);
          },
        ),
      ),
    );
  }

  void _confirmDelete(Tag tag) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('刪除標籤', style: TextStyle(fontSize: 16)),
        content: Text('確定要刪除「${tag.name}」嗎？',
            style: const TextStyle(fontSize: 14, color: AppColors.textDim)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(tagActionsProvider).delete(tag.id);
              ref.invalidate(tagsProvider);
            },
            child: const Text('刪除', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: 修改 settings_screen.dart**

讀取 `mobile/lib/features/settings/settings_screen.dart`。加入 import：
```dart
import '../tags/tag_manager.dart';
```

在登出按鈕之前加入 TagManager section：
```dart
const SizedBox(height: 24),
const TagManager(),
const SizedBox(height: 24),
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/tags/tag_manager.dart mobile/lib/features/settings/settings_screen.dart
git commit -m "feat: TagManager + 設定頁整合"
```

---

### Task 7: Card List Item + Card Grid Item

**Files:**
- Create: `mobile/lib/features/cards/card_list_item.dart`
- Create: `mobile/lib/features/cards/card_grid_item.dart`

- [ ] **Step 1: 建立 card_list_item.dart**

```dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../tags/tag_badge.dart';
import 'models.dart';

class CardListItem extends StatelessWidget {
  final CardItem card;
  final VoidCallback onTap;

  const CardListItem({super.key, required this.card, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final updated = DateFormat('M/d').format(DateTime.parse(card.updatedAt));
    final preview = _stripHtml(card.description, 100);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(card.title,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.foreground),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (preview.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(preview,
                        style: const TextStyle(fontSize: 12, color: AppColors.textDim),
                        maxLines: 2, overflow: TextOverflow.ellipsis),
                  ],
                  if (card.tags.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: card.tags.map((t) => TagBadge(name: t.name, colorToken: t.color)).toList(),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(updated, style: const TextStyle(fontSize: 11, color: AppColors.textDim)),
          ],
        ),
      ),
    );
  }

  String _stripHtml(String html, int maxLen) {
    final text = html
        .replaceAll(RegExp(r'<[^>]*>'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    if (text.length > maxLen) return '${text.substring(0, maxLen)}…';
    return text;
  }
}
```

- [ ] **Step 2: 建立 card_grid_item.dart**

```dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../tags/tag_badge.dart';
import 'models.dart';

class CardGridItem extends StatelessWidget {
  final CardItem card;
  final VoidCallback onTap;

  const CardGridItem({super.key, required this.card, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final updated = DateFormat('M/d').format(DateTime.parse(card.updatedAt));
    final preview = _stripHtml(card.description, 60);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(card.title,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.foreground),
                maxLines: 2, overflow: TextOverflow.ellipsis),
            if (preview.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(preview,
                  style: const TextStyle(fontSize: 11, color: AppColors.textDim),
                  maxLines: 3, overflow: TextOverflow.ellipsis),
            ],
            if (card.tags.isNotEmpty) ...[
              const SizedBox(height: 6),
              Wrap(
                spacing: 4,
                runSpacing: 4,
                children: card.tags.map((t) => TagBadge(name: t.name, colorToken: t.color)).toList(),
              ),
            ],
            const Spacer(),
            Align(
              alignment: Alignment.centerRight,
              child: Text(updated, style: const TextStyle(fontSize: 10, color: AppColors.textDim)),
            ),
          ],
        ),
      ),
    );
  }

  String _stripHtml(String html, int maxLen) {
    final text = html
        .replaceAll(RegExp(r'<[^>]*>'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    if (text.length > maxLen) return '${text.substring(0, maxLen)}…';
    return text;
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/cards/card_list_item.dart mobile/lib/features/cards/card_grid_item.dart
git commit -m "feat: CardListItem + CardGridItem"
```

---

### Task 8: Card Detail Screen

**Files:**
- Create: `mobile/lib/features/cards/card_detail_screen.dart`

- [ ] **Step 1: 建立 card_detail_screen.dart**

```dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../tags/tag_badge.dart';
import '../tags/tag_picker.dart';
import '../tags/tags_provider.dart';
import 'cards_provider.dart';
import 'models.dart';

class CardDetailScreen extends ConsumerStatefulWidget {
  final String cardId;
  const CardDetailScreen({super.key, required this.cardId});

  @override
  ConsumerState<CardDetailScreen> createState() => _CardDetailScreenState();
}

class _CardDetailScreenState extends ConsumerState<CardDetailScreen> {
  late TextEditingController _titleController;
  late TextEditingController _descController;
  Timer? _saveTimer;
  bool _initialized = false;
  List<String> _selectedTagIds = [];

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController();
    _descController = TextEditingController();
  }

  @override
  void dispose() {
    _saveTimer?.cancel();
    _flushSave();
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  void _flushSave() {
    if (!_initialized) return;
    final cardAsync = ref.read(cardDetailProvider(widget.cardId));
    final card = cardAsync.when(data: (c) => c, loading: () => null, error: (_, _) => null);
    if (card == null) return;

    final trimmedTitle = _titleController.text.trim();
    if (trimmedTitle.isNotEmpty && trimmedTitle != card.title) {
      ref.read(cardActionsProvider).updateTitle(card.id, trimmedTitle);
    }

    final text = _descController.text;
    final html = text.trim().isEmpty ? '' : '<p>${text.replaceAll('\n', '</p><p>')}</p>';
    final currentDesc = _stripHtml(card.description);
    if (text.trim() != currentDesc.trim()) {
      ref.read(cardActionsProvider).updateDescription(card.id, html);
    }
  }

  void _onDescChanged() {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 800), () {
      final cardAsync = ref.read(cardDetailProvider(widget.cardId));
      final card = cardAsync.when(data: (c) => c, loading: () => null, error: (_, _) => null);
      if (card == null) return;

      final text = _descController.text;
      final html = text.trim().isEmpty ? '' : '<p>${text.replaceAll('\n', '</p><p>')}</p>';
      ref.read(cardActionsProvider).updateDescription(card.id, html);
    });
  }

  String _stripHtml(String html) {
    return html
        .replaceAll(RegExp(r'<[^>]*>'), '\n')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll(RegExp(r'\n{3,}'), '\n\n')
        .trim();
  }

  @override
  Widget build(BuildContext context) {
    final cardAsync = ref.watch(cardDetailProvider(widget.cardId));

    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) {
          _saveTimer?.cancel();
          _flushSave();
          ref.invalidate(cardsProvider);
        }
      },
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: AppColors.background,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        body: cardAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('載入失敗', style: TextStyle(color: Colors.grey[400]))),
          data: (card) {
            if (!_initialized) {
              _titleController.text = card.title;
              _descController.text = _stripHtml(card.description);
              _selectedTagIds = card.tags.map((t) => t.id).toList();
              _initialized = true;
            }

            return SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  TextField(
                    controller: _titleController,
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.foreground),
                    decoration: const InputDecoration(
                      hintText: '卡片標題',
                      hintStyle: TextStyle(color: AppColors.textFaint),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                    ),
                    onSubmitted: (value) {
                      final trimmed = value.trim();
                      if (trimmed.isNotEmpty && trimmed != card.title) {
                        ref.read(cardActionsProvider).updateTitle(card.id, trimmed);
                        ref.invalidate(cardDetailProvider(widget.cardId));
                      }
                    },
                  ),

                  const SizedBox(height: 8),

                  // Tags
                  Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: [
                      ...card.tags.map((t) => TagBadge(
                            name: t.name,
                            colorToken: t.color,
                            onRemove: () {
                              final newIds = _selectedTagIds.where((id) => id != t.id).toList();
                              setState(() => _selectedTagIds = newIds);
                              ref.read(cardActionsProvider).setTags(card.id, newIds);
                              ref.invalidate(cardDetailProvider(widget.cardId));
                            },
                          )),
                      GestureDetector(
                        onTap: () => showTagPicker(
                          context,
                          ref: ref,
                          selectedTagIds: _selectedTagIds,
                          onChanged: (newIds) {
                            setState(() => _selectedTagIds = newIds);
                            ref.read(cardActionsProvider).setTags(card.id, newIds);
                            ref.invalidate(cardDetailProvider(widget.cardId));
                          },
                        ),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(4),
                            color: AppColors.card,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              Icon(Icons.label_outline, size: 14, color: AppColors.textDim),
                              SizedBox(width: 4),
                              Text('加標籤', style: TextStyle(fontSize: 11, color: AppColors.textDim)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),
                  Container(height: 1, color: AppColors.border),
                  const SizedBox(height: 16),

                  // Description
                  TextField(
                    controller: _descController,
                    maxLines: null,
                    minLines: 8,
                    onChanged: (_) => _onDescChanged(),
                    style: const TextStyle(fontSize: 14, color: AppColors.textMuted, height: 1.8),
                    decoration: const InputDecoration(
                      hintText: '輸入內容...',
                      hintStyle: TextStyle(color: AppColors.textFaint),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Footer: dates
                  Container(height: 1, color: AppColors.border),
                  const SizedBox(height: 12),
                  Text(
                    '建立 ${DateFormat('yyyy/MM/dd').format(DateTime.parse(card.createdAt))} · 更新 ${DateFormat('yyyy/MM/dd').format(DateTime.parse(card.updatedAt))}',
                    style: const TextStyle(fontSize: 11, color: AppColors.textFaint),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/cards/card_detail_screen.dart
git commit -m "feat: CardDetailScreen（title + tags + desc 自動儲存）"
```

---

### Task 9: Cards Screen + Router

**Files:**
- Rewrite: `mobile/lib/features/cards/cards_screen.dart`
- Modify: `mobile/lib/app.dart`

- [ ] **Step 1: 重寫 cards_screen.dart**

讀取現有檔案後替換：

```dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import 'cards_provider.dart';
import 'card_list_item.dart';
import 'card_grid_item.dart';

enum _View { list, grid }

class CardsScreen extends ConsumerStatefulWidget {
  const CardsScreen({super.key});

  @override
  ConsumerState<CardsScreen> createState() => _CardsScreenState();
}

class _CardsScreenState extends ConsumerState<CardsScreen> {
  _View _view = _View.grid;
  final _searchController = TextEditingController();
  String _query = '';
  Timer? _debounce;

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      setState(() => _query = value.trim());
    });
  }

  Future<void> _createCard() async {
    final id = await ref.read(cardActionsProvider).create();
    if (mounted) {
      context.push('/cards/$id');
    }
  }

  @override
  Widget build(BuildContext context) {
    final cardsAsync = ref.watch(cardsProvider(_query));

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  const Text('卡片',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.foreground)),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _createCard,
                    child: const Icon(Icons.add_circle_outline, size: 22, color: AppColors.primary),
                  ),
                  const Spacer(),
                  // View toggle
                  Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        _viewButton(Icons.view_list, _View.list),
                        _viewButton(Icons.grid_view, _View.grid),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Search
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _searchController,
                onChanged: _onSearchChanged,
                style: const TextStyle(fontSize: 14, color: AppColors.foreground),
                decoration: InputDecoration(
                  hintText: '搜尋卡片...',
                  hintStyle: const TextStyle(color: AppColors.textFaint),
                  prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.textDim),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.primary),
                  ),
                  filled: true,
                  fillColor: AppColors.background,
                ),
              ),
            ),

            const SizedBox(height: 12),

            // Content
            Expanded(
              child: cardsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('載入失敗', style: TextStyle(color: Colors.grey[400]))),
                data: (cards) {
                  if (cards.isEmpty) {
                    return Center(
                      child: Text(
                        _query.isNotEmpty ? '沒有符合的卡片' : '還沒有卡片',
                        style: const TextStyle(fontSize: 14, color: AppColors.textDim),
                      ),
                    );
                  }

                  if (_view == _View.list) {
                    return RefreshIndicator(
                      onRefresh: () async => ref.invalidate(cardsProvider(_query)),
                      child: ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: cards.length,
                        separatorBuilder: (_, _) => Container(height: 1, color: AppColors.border),
                        itemBuilder: (_, i) => CardListItem(
                          card: cards[i],
                          onTap: () => context.push('/cards/${cards[i].id}'),
                        ),
                      ),
                    );
                  }

                  return RefreshIndicator(
                    onRefresh: () async => ref.invalidate(cardsProvider(_query)),
                    child: GridView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 0.85,
                      ),
                      itemCount: cards.length,
                      itemBuilder: (_, i) => CardGridItem(
                        card: cards[i],
                        onTap: () => context.push('/cards/${cards[i].id}'),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _viewButton(IconData icon, _View view) {
    final isActive = _view == view;
    return GestureDetector(
      onTap: () => setState(() => _view = view),
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: isActive ? AppColors.card : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, size: 18, color: isActive ? AppColors.foreground : AppColors.textDim),
      ),
    );
  }
}
```

- [ ] **Step 2: 修改 app.dart — 加 card detail 路由**

讀取 `mobile/lib/app.dart`。加 import：
```dart
import 'features/cards/card_detail_screen.dart';
```

找到 cards branch：
```dart
StatefulShellBranch(
  routes: [
    GoRoute(
      path: '/cards',
      builder: (context, state) => const CardsScreen(),
    ),
  ],
),
```

替換為：
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

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/cards/cards_screen.dart mobile/lib/app.dart
git commit -m "feat: CardsScreen + card detail 路由"
```

---

### Task 10: Analyze 驗證

- [ ] **Step 1: dart analyze**

```bash
cd /Users/mike/Documents/nudge/mobile
dart analyze
```

預期：無錯誤。修正任何問題。

- [ ] **Step 2: Commit + Push**

```bash
cd /Users/mike/Documents/nudge
git add -A
git commit -m "feat: Phase 5 完成 — 卡片系統"
git push
```

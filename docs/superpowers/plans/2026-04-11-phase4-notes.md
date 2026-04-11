# Phase 4：日誌實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Flutter App 實作日誌功能，包含 flutter_quill 富文本編輯器、HTML↔Delta 互通、日期切換、自動儲存、Feed 列表，並將 CardDetailScreen 的 description 也改用 QuillEditorWidget

**Architecture:** 新增 `features/notes/` 目錄。核心是 `QuillEditorWidget` 封裝 flutter_quill + HTML↔Delta 轉換，被日誌頁和卡片詳細頁共用。Notes provider 以日期為 key 管理內容。Feed 用 FutureProvider 載入列表。

**Tech Stack:** Flutter, flutter_quill, flutter_quill_delta_from_html, vsc_quill_delta_to_html, Riverpod, Dio

---

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 新增 | `mobile/lib/shared/quill_editor_widget.dart` | Quill 編輯器封裝（HTML↔Delta + toolbar） |
| 新增 | `mobile/lib/features/notes/notes_provider.dart` | 日誌讀取/儲存 + feed provider |
| 重寫 | `mobile/lib/features/notes/notes_screen.dart` | 日誌主畫面 |
| 新增 | `mobile/lib/features/notes/notes_feed_screen.dart` | Feed 列表 |
| 修改 | `mobile/lib/features/cards/card_detail_screen.dart` | description 改用 QuillEditorWidget |
| 修改 | `mobile/lib/app.dart` | 加 feed 路由 |

---

### Task 1: Dependencies

**Files:**
- Modify: `mobile/pubspec.yaml`

- [ ] **Step 1: 安裝 flutter_quill + HTML 轉換套件**

```bash
cd /Users/mike/Documents/nudge/mobile
flutter pub add flutter_quill flutter_quill_delta_from_html vsc_quill_delta_to_html
```

注意：如果 `flutter_quill_delta_from_html` 或 `vsc_quill_delta_to_html` 版本衝突，用 `dart pub deps` 檢查可用版本。備選方案：`quill_html_converter`。

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/pubspec.yaml mobile/pubspec.lock
git commit -m "feat: 新增 flutter_quill + HTML 轉換 dependencies"
```

---

### Task 2: QuillEditorWidget 共用元件

**Files:**
- Create: `mobile/lib/shared/quill_editor_widget.dart`

- [ ] **Step 1: 建立共用 Quill 編輯器**

```bash
mkdir -p /Users/mike/Documents/nudge/mobile/lib/shared
```

建立 `mobile/lib/shared/quill_editor_widget.dart`：

```dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_quill/flutter_quill.dart';
import 'package:flutter_quill_delta_from_html/flutter_quill_delta_from_html.dart';
import 'package:vsc_quill_delta_to_html/vsc_quill_delta_to_html.dart';
import '../core/theme.dart';

class QuillEditorWidget extends StatefulWidget {
  final String initialHtml;
  final ValueChanged<String> onChanged;
  final bool readOnly;
  final bool showToolbar;
  final int debounceMs;

  const QuillEditorWidget({
    super.key,
    required this.initialHtml,
    required this.onChanged,
    this.readOnly = false,
    this.showToolbar = true,
    this.debounceMs = 800,
  });

  @override
  State<QuillEditorWidget> createState() => _QuillEditorWidgetState();
}

class _QuillEditorWidgetState extends State<QuillEditorWidget> {
  late QuillController _controller;
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    _controller = _createController(widget.initialHtml);
    _controller.document.changes.listen((_) => _onDocumentChanged());
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _flushSave();
    _controller.dispose();
    super.dispose();
  }

  QuillController _createController(String html) {
    if (html.trim().isEmpty || html.trim() == '<p></p>') {
      return QuillController.basic();
    }
    try {
      final delta = HtmlToDelta().convert(html);
      final doc = Document.fromDelta(delta);
      return QuillController(document: doc, selection: const TextSelection.collapsed(offset: 0));
    } catch (_) {
      return QuillController.basic();
    }
  }

  String _deltaToHtml() {
    final delta = _controller.document.toDelta();
    final ops = delta.toJson();
    final converter = QuillDeltaToHtmlConverter(
      List<Map<String, dynamic>>.from(ops),
    );
    return converter.convert();
  }

  void _onDocumentChanged() {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(Duration(milliseconds: widget.debounceMs), () {
      widget.onChanged(_deltaToHtml());
    });
  }

  void _flushSave() {
    if (_debounceTimer?.isActive ?? false) {
      _debounceTimer!.cancel();
      widget.onChanged(_deltaToHtml());
    }
  }

  /// 外部呼叫：重設內容（切換日期時用）
  void setContent(String html) {
    _debounceTimer?.cancel();
    final newController = _createController(html);
    setState(() {
      _controller.dispose();
      _controller = newController;
      _controller.document.changes.listen((_) => _onDocumentChanged());
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: QuillEditor.basic(
            controller: _controller,
            config: QuillEditorConfig(
              placeholder: '輸入內容...',
              padding: const EdgeInsets.all(16),
              readOnlyMouseCursor: SystemMouseCursors.text,
              customStyles: DefaultStyles(
                h1: DefaultTextBlockStyle(
                  const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.foreground, height: 1.3),
                  const HorizontalSpacing(0, 0),
                  const VerticalSpacing(12, 6),
                  null,
                ),
                h2: DefaultTextBlockStyle(
                  const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.foreground, height: 1.3),
                  const HorizontalSpacing(0, 0),
                  const VerticalSpacing(10, 4),
                  null,
                ),
                h3: DefaultTextBlockStyle(
                  const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: AppColors.foreground, height: 1.4),
                  const HorizontalSpacing(0, 0),
                  const VerticalSpacing(8, 4),
                  null,
                ),
                paragraph: DefaultTextBlockStyle(
                  const TextStyle(fontSize: 14, color: AppColors.textMuted, height: 1.8),
                  const HorizontalSpacing(0, 0),
                  const VerticalSpacing(2, 2),
                  null,
                ),
                code: DefaultTextBlockStyle(
                  TextStyle(fontSize: 13, color: AppColors.foreground, fontFamily: 'monospace', backgroundColor: AppColors.card),
                  const HorizontalSpacing(0, 0),
                  const VerticalSpacing(4, 4),
                  BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(4)),
                ),
              ),
            ),
          ),
        ),
        if (widget.showToolbar && !widget.readOnly)
          Container(
            decoration: BoxDecoration(
              color: AppColors.card,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: QuillSimpleToolbar(
              controller: _controller,
              config: const QuillSimpleToolbarConfig(
                showBoldButton: true,
                showItalicButton: true,
                showUnderLineButton: false,
                showStrikeThrough: false,
                showColorButton: false,
                showBackgroundColorButton: false,
                showFontFamily: false,
                showFontSize: false,
                showHeaderStyle: true,
                showListNumbers: true,
                showListBullets: true,
                showListCheck: true,
                showCodeBlock: true,
                showInlineCode: true,
                showQuote: false,
                showLink: false,
                showIndent: false,
                showImageButton: false,
                showVideoButton: false,
                showCameraButton: false,
                showAlignmentButtons: false,
                showDirection: false,
                showSearchButton: false,
                showSubscript: false,
                showSuperscript: false,
                showClipboardCut: false,
                showClipboardCopy: false,
                showClipboardPaste: false,
                showClearFormat: false,
                multiRowsDisplay: false,
              ),
            ),
          ),
      ],
    );
  }
}
```

**重要提醒給實作者：** flutter_quill 的 API 大版本之間差異很大。如果上面的 code 編譯不過，需要查 flutter_quill 當前版本的 API：
- `QuillEditor.basic()` 的參數可能不同
- `QuillSimpleToolbar` 可能叫 `QuillToolbar.simple`
- `DefaultStyles` 的 constructor 可能不同
- `HtmlToDelta` 可能在不同 package

遇到 API 不匹配時，跑 `dart doc` 或看 pub.dev 的 API reference 調整。

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/shared/quill_editor_widget.dart
git commit -m "feat: QuillEditorWidget 共用富文本元件"
```

---

### Task 3: Notes Provider

**Files:**
- Create: `mobile/lib/features/notes/notes_provider.dart`

- [ ] **Step 1: 建立 notes_provider.dart**

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../auth/auth_provider.dart';

// 日誌內容（以日期為 key）
final notesContentProvider =
    FutureProvider.family<String, String>((ref, date) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.dio.get('/api/daily/$date/notes');
  return response.data['content'] as String? ?? '';
});

// Feed 列表
class NoteFeedItem {
  final String id;
  final String date;
  final String content;
  final String createdAt;

  const NoteFeedItem({
    required this.id,
    required this.date,
    required this.content,
    required this.createdAt,
  });

  factory NoteFeedItem.fromJson(Map<String, dynamic> json) => NoteFeedItem(
        id: json['id'] as String,
        date: json['date'] as String,
        content: json['content'] as String? ?? '',
        createdAt: json['createdAt'] as String,
      );
}

final notesFeedProvider = FutureProvider<List<NoteFeedItem>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.dio.get('/api/notes/feed', queryParameters: {'limit': '50'});
  final list = response.data['notes'] as List;
  return list.map((e) => NoteFeedItem.fromJson(e as Map<String, dynamic>)).toList();
});

// 當前選中的日誌日期
final selectedNoteDateProvider = NotifierProvider<SelectedNoteDateNotifier, String>(
  SelectedNoteDateNotifier.new,
);

class SelectedNoteDateNotifier extends Notifier<String> {
  @override
  String build() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  void setDate(String date) => state = date;
}

// Notes actions
class NotesActions {
  final ApiClient _api;
  NotesActions(this._api);

  Future<void> save(String date, String htmlContent) async {
    await _api.dio.put('/api/daily/$date/notes', data: {'content': htmlContent});
  }
}

final notesActionsProvider = Provider<NotesActions>((ref) {
  return NotesActions(ref.read(apiClientProvider));
});
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/notes/notes_provider.dart
git commit -m "feat: notes provider（content + feed + actions）"
```

---

### Task 4: Notes Screen

**Files:**
- Rewrite: `mobile/lib/features/notes/notes_screen.dart`

- [ ] **Step 1: 重寫 notes_screen.dart**

讀取現有檔案後替換：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../core/date_utils.dart';
import '../../shared/quill_editor_widget.dart';
import 'notes_provider.dart';

class NotesScreen extends ConsumerStatefulWidget {
  const NotesScreen({super.key});

  @override
  ConsumerState<NotesScreen> createState() => _NotesScreenState();
}

class _NotesScreenState extends ConsumerState<NotesScreen> {
  final _editorKey = GlobalKey<_QuillEditorWrapperState>();

  @override
  Widget build(BuildContext context) {
    final selectedDate = ref.watch(selectedNoteDateProvider);
    final contentAsync = ref.watch(notesContentProvider(selectedDate));

    final dateObj = DateTime.parse(selectedDate);
    final today = formatDate(DateTime.now());
    final isToday = selectedDate == today;
    final dateLabel = isToday
        ? '${DateFormat('M/d').format(dateObj)} · 今天'
        : DateFormat('M/d · EEEE', 'zh_TW').format(dateObj);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  const Text('日誌',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.foreground)),
                  const Spacer(),
                  Text(dateLabel, style: const TextStyle(fontSize: 13, color: AppColors.textDim)),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () => context.push('/notes/feed'),
                    child: const Padding(
                      padding: EdgeInsets.all(4),
                      child: Icon(Icons.list, size: 22, color: AppColors.textDim),
                    ),
                  ),
                ],
              ),
            ),

            // Date navigation
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.chevron_left, color: AppColors.textDim),
                    onPressed: () {
                      _saveAndSwitchDate(dateObj.subtract(const Duration(days: 1)));
                    },
                  ),
                  GestureDetector(
                    onTap: () {
                      if (!isToday) _saveAndSwitchDate(DateTime.now());
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Text(
                        isToday ? '今天' : DateFormat('M月d日').format(dateObj),
                        style: TextStyle(
                          fontSize: 14,
                          color: isToday ? AppColors.primary : AppColors.foreground,
                          fontWeight: isToday ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.chevron_right, color: AppColors.textDim),
                    onPressed: () {
                      _saveAndSwitchDate(dateObj.add(const Duration(days: 1)));
                    },
                  ),
                ],
              ),
            ),

            // Editor
            Expanded(
              child: contentAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('載入失敗', style: TextStyle(color: Colors.grey[400]))),
                data: (html) => _QuillEditorWrapper(
                  key: ValueKey(selectedDate),
                  initialHtml: html,
                  onSave: (htmlContent) {
                    ref.read(notesActionsProvider).save(selectedDate, htmlContent);
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _saveAndSwitchDate(DateTime newDate) {
    ref.read(selectedNoteDateProvider.notifier).setDate(formatDate(newDate));
  }
}

class _QuillEditorWrapper extends StatefulWidget {
  final String initialHtml;
  final ValueChanged<String> onSave;

  const _QuillEditorWrapper({
    super.key,
    required this.initialHtml,
    required this.onSave,
  });

  @override
  State<_QuillEditorWrapper> createState() => _QuillEditorWrapperState();
}

class _QuillEditorWrapperState extends State<_QuillEditorWrapper> {
  @override
  Widget build(BuildContext context) {
    return QuillEditorWidget(
      initialHtml: widget.initialHtml,
      onChanged: widget.onSave,
      showToolbar: true,
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/notes/notes_screen.dart
git commit -m "feat: NotesScreen 日誌主畫面"
```

---

### Task 5: Notes Feed Screen

**Files:**
- Create: `mobile/lib/features/notes/notes_feed_screen.dart`

- [ ] **Step 1: 建立 notes_feed_screen.dart**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../core/date_utils.dart';
import 'notes_provider.dart';

class NotesFeedScreen extends ConsumerWidget {
  const NotesFeedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feedAsync = ref.watch(notesFeedProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('日誌', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      ),
      body: feedAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('載入失敗', style: TextStyle(color: Colors.grey[400]))),
        data: (notes) {
          if (notes.isEmpty) {
            return const Center(
              child: Text('還沒有日誌', style: TextStyle(fontSize: 14, color: AppColors.textDim)),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(notesFeedProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: notes.length,
              separatorBuilder: (_, _) => Container(
                height: 1,
                margin: const EdgeInsets.symmetric(vertical: 4),
                color: AppColors.border,
              ),
              itemBuilder: (_, index) {
                final note = notes[index];
                final dateObj = DateTime.parse(note.date);
                final dateStr = DateFormat('M/d, y · EEEE', 'zh_TW').format(dateObj);
                final preview = _stripHtml(note.content, 120);

                return GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    ref.read(selectedNoteDateProvider.notifier).setDate(note.date);
                    Navigator.pop(context);
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(dateStr,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.foreground)),
                        if (preview.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(preview,
                              style: const TextStyle(fontSize: 12, color: AppColors.textDim),
                              maxLines: 2, overflow: TextOverflow.ellipsis),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
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

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/notes/notes_feed_screen.dart
git commit -m "feat: NotesFeedScreen 日誌 Feed 列表"
```

---

### Task 6: Router + CardDetailScreen 改用 QuillEditorWidget

**Files:**
- Modify: `mobile/lib/app.dart`
- Modify: `mobile/lib/features/cards/card_detail_screen.dart`

- [ ] **Step 1: 修改 app.dart — 加 feed 路由**

讀取 `mobile/lib/app.dart`。加 import：
```dart
import 'features/notes/notes_feed_screen.dart';
```

找到 notes branch：
```dart
StatefulShellBranch(
  routes: [
    GoRoute(
      path: '/notes',
      builder: (context, state) => const NotesScreen(),
    ),
  ],
),
```

替換為：
```dart
StatefulShellBranch(
  routes: [
    GoRoute(
      path: '/notes',
      builder: (context, state) => const NotesScreen(),
      routes: [
        GoRoute(
          path: 'feed',
          builder: (context, state) => const NotesFeedScreen(),
        ),
      ],
    ),
  ],
),
```

- [ ] **Step 2: 修改 CardDetailScreen — description 改用 QuillEditorWidget**

讀取 `mobile/lib/features/cards/card_detail_screen.dart`。

加 import：
```dart
import '../../shared/quill_editor_widget.dart';
```

找到 description 區域的 TextField：
```dart
// Description
TextField(
  controller: _descController,
  maxLines: null,
  minLines: 8,
  onChanged: (_) => _onDescChanged(),
  ...
),
```

替換為：
```dart
// Description（富文本）
SizedBox(
  height: 300,
  child: QuillEditorWidget(
    key: ValueKey('desc-${widget.taskId}'),
    initialHtml: card.description,
    onChanged: (html) {
      ref.read(cardActionsProvider).updateDescription(card.id, html);
    },
    showToolbar: true,
  ),
),
```

同時移除不再需要的：
- `_descController` 的宣告、initState、dispose
- `_onDescChanged()` 方法
- `_stripHtml()` 方法
- `_flushSave()` 中 description 相關的程式碼

注意：`_flushSave()` 只保留 title 的部分。`_saveTimer` 也不再需要（QuillEditorWidget 內部處理 debounce）。

簡化後 `_flushSave()`：
```dart
void _flushSave() {
  if (!_initialized) return;
  final cardAsync = ref.read(cardDetailProvider(widget.taskId));
  final card = cardAsync.when(data: (c) => c, loading: () => null, error: (_, _) => null);
  if (card == null) return;

  final trimmedTitle = _titleController.text.trim();
  if (trimmedTitle.isNotEmpty && trimmedTitle != card.title) {
    ref.read(cardActionsProvider).updateTitle(card.id, trimmedTitle);
  }
}
```

移除 `_saveTimer`、`_descController`、`_onDescChanged()`、`_stripHtml()`。

- [ ] **Step 3: Run dart analyze**

```bash
cd /Users/mike/Documents/nudge/mobile
dart analyze
```

- [ ] **Step 4: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/app.dart mobile/lib/features/cards/card_detail_screen.dart
git commit -m "feat: feed 路由 + CardDetailScreen 改用 QuillEditorWidget"
```

---

### Task 7: Analyze + 驗證

- [ ] **Step 1: dart analyze**

```bash
cd /Users/mike/Documents/nudge/mobile
dart analyze
```

修正所有錯誤。flutter_quill 的 API 在不同版本差異大，可能需要：
- 查 `flutter pub deps | grep quill` 確認實際安裝的版本
- 讀 `~/.pub-cache/hosted/pub.dev/flutter_quill-*/lib/` 的原始碼確認 API
- 調整 `QuillEditorWidget` 的 API 呼叫

- [ ] **Step 2: Commit + Push**

```bash
cd /Users/mike/Documents/nudge
git add -A
git commit -m "feat: Phase 4 完成 — 日誌 + 富文本編輯"
git push
```

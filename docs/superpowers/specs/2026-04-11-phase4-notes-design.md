# Phase 4：日誌設計

## 摘要

在 Flutter App 實作日誌功能。使用 flutter_quill 富文本編輯器，HTML ↔ Delta 雙向轉換和 Web 互通。包含日期切換、自動儲存、Feed 列表。

## 技術決策

| 項目 | 決定 | 理由 |
|------|------|------|
| 富文本編輯器 | flutter_quill | Flutter 最成熟，社群大，支援標題/列表/checkbox/code |
| 格式互通 | HTML ↔ Delta 轉換 | Web 存 HTML，Quill 用 Delta，需雙向轉 |
| HTML→Delta | flutter_quill_delta_from_html | 社群維護的轉換套件 |
| Delta→HTML | flutter_quill_to_html | 社群維護的轉換套件 |
| 自動儲存 | 800ms debounce | 同 Web |

## 核心挑戰：HTML ↔ Delta 互通

### 載入流程
```
API GET /api/daily/{date}/notes
  → { content: "<h2>標題</h2><p>內容</p>" }
  → HTML string
  → flutter_quill_delta_from_html 轉 Delta
  → QuillController.document
  → 顯示在編輯器
```

### 儲存流程
```
使用者編輯（onChange 觸發）
  → QuillController.document
  → flutter_quill_to_html 轉 HTML string
  → API PUT /api/daily/{date}/notes body: { content: html }
```

### 已知限制
- TipTap 的某些進階 HTML（code block 語言標記、task list checked 狀態細節）可能轉換有損
- 基本格式（H1-H3、粗斜體、列表、checkbox、code block）應該能正確互通
- 如果轉換出問題，App 端編輯會覆蓋 Web 端的格式 — 這是可接受的 trade-off

## 畫面結構

### NotesScreen（主畫面）

```
┌──────────────────────────────┐
│ 日誌      4/11 · 今天    ≡   │  ← 標題 + 日期 + Feed 按鈕
├──────────────────────────────┤
│   ← [日期]  今天  [日期] →   │  ← 日期切換
├──────────────────────────────┤
│                              │
│  富文本編輯區                │
│  支援標題、粗斜體、列表...   │
│                              │
│                              │
│                              │
├──────────────────────────────┤
│ B I H1 H2 • 1. ☐ </>        │  ← Toolbar
└──────────────────────────────┘
```

### NotesFeedScreen（Feed 列表）

```
┌──────────────────────────────┐
│ ← 返回              日誌    │
├──────────────────────────────┤
│ 4/10, 2026                   │
│ 今天做了很多事情...          │
├──────────────────────────────┤
│ 4/9, 2026                    │
│ 會議紀錄整理完成...          │
├──────────────────────────────┤
│ 4/8, 2026                    │
│ 新功能規劃討論...            │
└──────────────────────────────┘
```

## 元件拆分

```
mobile/lib/features/notes/
├── notes_screen.dart          — 主畫面（日期切換 + 編輯器 + toolbar）
├── notes_provider.dart        — Riverpod：日誌讀取/儲存 + feed
├── notes_feed_screen.dart     — Feed 列表頁
├── quill_editor_widget.dart   — Quill 編輯器封裝（HTML ↔ Delta + onChange）
```

## Data Models

```dart
class NoteData {
  final String content;  // HTML string
  final String? id;
}

class NoteFeedItem {
  final String id;
  final String date;
  final String content;  // HTML string（用於預覽）
  final String createdAt;
}
```

## Riverpod Providers

### notesProvider
```dart
// 以日期為 key，取得當天日誌內容
final notesProvider = FutureProvider.family<String, String>((ref, date) async {
  final response = await api.get('/api/daily/$date/notes');
  return response.data['content'] as String? ?? '';
});
```

### notesFeedProvider
```dart
// Feed 列表
final notesFeedProvider = FutureProvider<List<NoteFeedItem>>((ref) async {
  final response = await api.get('/api/notes/feed?limit=50');
  return (response.data['notes'] as List).map(...).toList();
});
```

### NotesActions
```dart
class NotesActions {
  Future<void> save(String date, String htmlContent);
}
```

## QuillEditorWidget 封裝

獨立元件，接收 HTML + 回傳 HTML：

```dart
class QuillEditorWidget extends StatefulWidget {
  final String initialHtml;
  final ValueChanged<String> onChanged;  // debounced HTML output
  final bool readOnly;
}
```

內部：
- initState 時 HTML → Delta → QuillController
- onChange 監聽 document changes → debounce 800ms → Delta → HTML → 呼叫 onChanged
- 底部 QuillSimpleToolbar

### Toolbar 按鈕
- H1 / H2 / H3（標題）
- Bold / Italic（粗斜體）
- Bullet list / Ordered list（列表）
- Check list（checkbox）
- Code block
- 不做：圖片、連結、顏色、字體大小

## API 對接

| 操作 | Endpoint | Method | Body |
|------|----------|--------|------|
| 取得日誌 | `/api/daily/{date}/notes` | GET | — |
| 儲存日誌 | `/api/daily/{date}/notes` | PUT | `{ content: "<html>" }` |
| Feed 列表 | `/api/notes/feed?limit=50` | GET | — |

### API Response 格式

GET `/api/daily/{date}/notes`:
```json
{ "content": "<h2>標題</h2><p>內容...</p>", "id": "xxx" }
```

GET `/api/notes/feed`:
```json
{
  "notes": [
    { "id": "xxx", "date": "2026-04-10", "content": "<p>...</p>", "createdAt": "..." }
  ],
  "nextCursor": null
}
```

## 日期切換

簡化版（不用週曆 bar）：
- 左箭頭 ← 前一天
- 右箭頭 → 後一天
- 中間顯示日期（例：「4/11 · 今天」「4/10 · 昨天」）
- 「今天」按鈕快速回到今天
- 切換日期時：儲存當前內容 → 載入新日期內容

## 路由

在 `app.dart` 的 notes branch：
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

Feed 點擊項目 → `context.pop()` 回到 NotesScreen + 切換日期。
或者用 query parameter：`context.go('/notes?date=2026-04-10')`。
簡化版：Feed 點擊 → pop + 更新 selectedNoteDate provider。

## 依賴新增

```yaml
flutter_quill: ^11.0.0
flutter_quill_delta_from_html: ^1.4.0
flutter_quill_to_html: ^1.1.0  # 或 vsc_quill_delta_to_html
```

注意：這些套件版本需要在實作時確認相容性。flutter_quill 大版本更新頻繁。

## 共用：CardDetailScreen 也用 QuillEditorWidget

目前 CardDetailScreen 的 description 用純文字 TextField。完成 QuillEditorWidget 後，替換 CardDetailScreen 的 description 區域為 QuillEditorWidget，讓卡片也能富文本編輯。

## 不做

- Block 拖移排序
- Slash command
- 語法高亮（code block 只有等寬字體，不著色）
- 圖片/附件上傳
- 離線快取

## 完成標準

- [ ] Quill 編輯器能打字 + 格式化（H1-H3、粗斜體、列表、checkbox、code block）
- [ ] Toolbar 底部固定，按鈕可用
- [ ] 自動儲存（800ms debounce）
- [ ] 日期切換正常（左右箭頭 + 今天按鈕）
- [ ] 切換日期時自動儲存 + 載入新內容
- [ ] Feed 列表顯示過往日誌（日期 + 預覽）
- [ ] Feed 點擊 → 回到編輯器切到該日期
- [ ] Web 編輯的內容在 App 能正確顯示
- [ ] App 編輯的內容在 Web 能正確顯示
- [ ] CardDetailScreen 的 description 也改用 QuillEditorWidget

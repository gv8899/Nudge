# Phase 3：行動（每日任務）設計

## 摘要

在 Flutter App 實作每日任務完整功能，對應 Web 的 `/day/[date]` 頁面。包含週曆導航、任務 CRUD、拖曳排序、狀態切換、overdue 管理、任務詳細頁（全螢幕 push）。

## 畫面結構

### TasksScreen（主畫面）

```
┌──────────────────────────────┐
│ 行動                         │  ← 標題
│ Friday · 4/11, 2026          │  ← 日期
├──────────────────────────────┤
│ < Mon Tue Wed Thu [Fri] >  今│  ← 週曆 bar
├──────────────────────────────┤
│ [新增任務]                    │  ← 輸入框
├──────────────────────────────┤
│ ▼ 前幾天的 (2)               │  ← Overdue（可收合）
│   □ 舊任務 4/9  排入今天 📅 🗄│
│   □ 舊任務 4/8  排入今天 📅 🗄│
├──────────────────────────────┤
│ □ 任務一          📄 📅 ●    │  ← 任務列表
│ □ 任務二          📄 📅 ●    │
│ ☑ 已完成任務      📄 📅 ●    │  ← 已完成的排底部
└──────────────────────────────┘
```

### TaskDetailScreen（全螢幕 push）

```
┌──────────────────────────────┐
│ ← 返回        狀態: 自己處理中 │  ← AppBar
├──────────────────────────────┤
│ 任務標題（可編輯）             │
├──────────────────────────────┤
│ Description 內容（HTML 唯讀） │
│ ...                          │
└──────────────────────────────┘
```

## 元件拆分

```
mobile/lib/features/tasks/
├── tasks_screen.dart          — 主畫面（組裝子元件）
├── tasks_provider.dart        — Riverpod provider：當天資料 + overdue
├── calendar_bar.dart          — 週曆導航（左右滑動、圓點標記、今天按鈕）
├── task_create_input.dart     — 新增任務輸入框
├── task_card.dart             — 單一任務（checkbox + title + 右側 icons）
├── task_list.dart             — 任務列表（含 ReorderableListView 拖曳排序）
├── overdue_section.dart       — 前幾天未完成區塊（收合、排入今天、移日期、封存）
├── task_detail_screen.dart    — 全螢幕詳細頁（title 編輯 + status + HTML 顯示）
└── task_status_picker.dart    — 狀態選擇 bottom sheet（6 種狀態）
```

## Riverpod Providers

### `tasksProvider`

```dart
// 以日期為參數的 family provider
final tasksProvider = FutureProvider.family<DailyData, String>((ref, date) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.dio.get('/api/daily/$date');
  return DailyData.fromJson(response.data);
});
```

### `weekDotsProvider`

```dart
// 取得一週哪些日期有任務
final weekDotsProvider = FutureProvider.family<Set<String>, String>((ref, weekStart) async {
  final apiClient = ref.read(apiClientProvider);
  final weekEnd = /* weekStart + 6 days */;
  final response = await apiClient.dio.get('/api/daily/week?start=$weekStart&end=$weekEnd');
  return Set<String>.from(response.data['datesWithTasks']);
});
```

### Data Models

```dart
class DailyData {
  final List<TaskAssignment> assignments;
  final List<TaskAssignment> overdueTasks;
  final String date;
}

class TaskAssignment {
  final String id;        // assignment ID
  final String taskId;
  final String date;
  final bool isCompleted;
  final int sortOrder;
  final Task task;
}

class Task {
  final String id;
  final String title;
  final String? description;
  final String status;    // inbox, backlog, in_progress, waiting, done, archived
  final String createdAt;
  final String updatedAt;
  final String? completedAt;
}
```

## API 對接

| 操作 | Endpoint | Method | Body |
|------|----------|--------|------|
| 取得當天任務 + overdue | `/api/daily/{date}` | GET | — |
| 新增任務 | `/api/daily/{date}/tasks` | POST | `{ title, status: "in_progress" }` |
| 完成/取消完成 | `/api/daily/{date}/tasks` | PATCH | `{ assignmentId, taskId, isCompleted }` |
| 移到其他日期 | `/api/daily/{date}/tasks` | PATCH | `{ assignmentId, moveToDate }` |
| 排序 | `/api/daily/{date}/tasks/reorder` | PUT | `{ order: [{ id, sortOrder }] }` |
| 狀態變更 | `/api/tasks/{id}/status` | PATCH | `{ status }` |
| 更新標題 | `/api/tasks/{id}` | PATCH | `{ title }` |
| 週曆圓點 | `/api/daily/week?start=&end=` | GET | — |

## 週曆 Bar

- 橫向 7 天（Mon–Sun），以週一為起始
- 當天高亮（primary 色圓角按鈕）
- 有任務的日期在文字上方顯示小圓點（primary 色）
- 左右箭頭切換上/下一週
- 右側「今天」按鈕快速回到今天
- 切換日期時 invalidate `tasksProvider` 觸發重新載入

## 任務列表

- `ReorderableListView.builder` 實作拖曳排序
- 長按觸發拖曳
- 放開後呼叫 `PUT /api/daily/{date}/tasks/reorder`
- 已完成的任務排在底部（前端排序：未完成在前，已完成在後）
- 點擊 checkbox → toggle 完成狀態
- 點擊標題 → push 到 TaskDetailScreen

## 任務卡片（task_card.dart）

每一行的結構：
- 左側：checkbox（方形，和 Web 一致的樣式）
- 中間：標題（已完成的加刪除線 + 淡色）
- 右側 icons：
  - 📄 有 description 時顯示（點擊進詳細頁）
  - 📅 移到其他日期（點擊開 DatePicker）
  - ● 狀態圓點（點擊開 StatusPicker bottom sheet）

## Overdue Section

- 可收合（ChevronDown / ChevronRight）
- 六日（週六日）預設收合
- 每個 overdue 任務：checkbox + 標題 + 原始日期 + 「排入今天」按鈕 + 📅 + 封存 icon
- 封存前跳確認 dialog
- 「排入今天」= PATCH moveToDate: 今天

## 狀態選擇（task_status_picker.dart）

- Bottom sheet 列出 6 種狀態
- 每個狀態有顏色圓點 + 中文 label
- 點擊選中後關閉 bottom sheet + 呼叫 API

狀態列表（和 Web constants 一致）：
| Status | Label | Color |
|--------|-------|-------|
| inbox | 暫記 | status-inbox |
| backlog | 待排入 | status-backlog |
| in_progress | 自己處理中 | status-in-progress |
| waiting | 等待他人 | status-waiting |
| done | 完成 | status-done |
| archived | 已封存 | status-archived |

## 任務詳細頁（task_detail_screen.dart）

- AppBar：返回按鈕 + 狀態 badge（可點擊切換）
- Title：大字顯示，可點擊進入編輯模式（TextField）
- Description：HTML 內容唯讀渲染（用 `flutter_widget_from_html_core` 或類似 package）
- Phase 3 不做 description 編輯（Phase 4 富文本編輯器）

## 新增依賴

```yaml
dependencies:
  flutter_widget_from_html_core: ^0.15.0   # HTML 渲染
  intl: ^0.19.0                             # 日期格式化
```

## 路由新增

在 `app.dart` 的 tasks branch 加入詳細頁路由：

```dart
StatefulShellBranch(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const TasksScreen(),
      routes: [
        GoRoute(
          path: 'task/:id',
          builder: (context, state) => TaskDetailScreen(
            taskId: state.pathParameters['id']!,
          ),
        ),
      ],
    ),
  ],
),
```

## 配色

任務狀態顏色從 Web 的 CSS variables 對應到 Flutter Color：

```dart
const statusColors = {
  'inbox': Color(0xFF8A8578),
  'backlog': Color(0xFF7A8B9C),
  'in_progress': Color(0xFF5A9BC5),
  'waiting': Color(0xFF9A7B4F),
  'done': Color(0xFF5A7050),
  'archived': Color(0xFF6B6560),
};
```

## 不做

- Description 編輯（Phase 4）
- Tag 顯示（Phase 5）
- 離線快取
- 推播通知
- 下拉刷新（先不做，切換日期即重新載入）

## 完成標準

- [ ] 週曆 bar 切換日期正常，有任務的日期顯示圓點
- [ ] 新增任務後列表立即更新
- [ ] Checkbox toggle 完成/取消完成
- [ ] 長按拖曳排序，放開後順序持久化
- [ ] 狀態切換（bottom sheet 選擇）
- [ ] Overdue section 收合/展開、排入今天、移日期、封存
- [ ] 六日預設收合 overdue
- [ ] 封存確認 dialog
- [ ] 點擊任務進入詳細頁（全螢幕 push）
- [ ] 詳細頁 title 可編輯
- [ ] 詳細頁 description HTML 唯讀顯示
- [ ] 操作後 Web 端能看到同步的變更

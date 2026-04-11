# Phase 3：行動（每日任務）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Flutter App 實作每日任務完整功能，包含週曆、任務 CRUD、拖曳排序、狀態切換、overdue、任務詳細頁

**Architecture:** Feature-based 結構在 `mobile/lib/features/tasks/` 下。Riverpod FutureProvider.family 以日期為 key 管理資料。所有 API 呼叫透過已有的 ApiClient（自動帶 Bearer token）。GoRouter 加入 `/task/:id` 子路由。

**Tech Stack:** Flutter, Riverpod, Dio, GoRouter, flutter_widget_from_html_core, intl

---

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 新增 | `mobile/lib/features/tasks/models.dart` | Data models（Task, TaskAssignment, DailyData） |
| 新增 | `mobile/lib/features/tasks/tasks_provider.dart` | Riverpod providers |
| 新增 | `mobile/lib/features/tasks/calendar_bar.dart` | 週曆導航 |
| 新增 | `mobile/lib/features/tasks/task_create_input.dart` | 新增任務輸入框 |
| 新增 | `mobile/lib/features/tasks/task_card.dart` | 單一任務卡片 |
| 新增 | `mobile/lib/features/tasks/task_list.dart` | 任務列表（含拖曳） |
| 新增 | `mobile/lib/features/tasks/overdue_section.dart` | Overdue 區塊 |
| 新增 | `mobile/lib/features/tasks/task_status_picker.dart` | 狀態選擇 bottom sheet |
| 新增 | `mobile/lib/features/tasks/task_detail_screen.dart` | 詳細頁 |
| 重寫 | `mobile/lib/features/tasks/tasks_screen.dart` | 主畫面組裝 |
| 修改 | `mobile/lib/app.dart` | 加入 task detail 路由 |
| 修改 | `mobile/pubspec.yaml` | 加 flutter_widget_from_html_core, intl |

---

### Task 1: Dependencies + Data Models

**Files:**
- Modify: `mobile/pubspec.yaml`
- Create: `mobile/lib/features/tasks/models.dart`

- [ ] **Step 1: 安裝新 dependencies**

```bash
cd /Users/mike/Documents/nudge/mobile
flutter pub add flutter_widget_from_html_core intl
```

- [ ] **Step 2: 建立 models.dart**

建立 `mobile/lib/features/tasks/models.dart`：

```dart
class Task {
  final String id;
  final String title;
  final String? description;
  final String status;
  final String createdAt;
  final String updatedAt;
  final String? completedAt;
  final String? remindAt;
  final int sortOrder;

  const Task({
    required this.id,
    required this.title,
    this.description,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.completedAt,
    this.remindAt,
    required this.sortOrder,
  });

  factory Task.fromJson(Map<String, dynamic> json) => Task(
        id: json['id'] as String,
        title: json['title'] as String,
        description: json['description'] as String?,
        status: json['status'] as String,
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
        completedAt: json['completedAt'] as String?,
        remindAt: json['remindAt'] as String?,
        sortOrder: json['sortOrder'] as int? ?? 0,
      );
}

class TaskAssignment {
  final String id;
  final String taskId;
  final String date;
  final bool isCompleted;
  final int sortOrder;
  final Task task;

  const TaskAssignment({
    required this.id,
    required this.taskId,
    required this.date,
    required this.isCompleted,
    required this.sortOrder,
    required this.task,
  });

  factory TaskAssignment.fromJson(Map<String, dynamic> json) => TaskAssignment(
        id: json['id'] as String,
        taskId: json['taskId'] as String,
        date: json['date'] as String,
        isCompleted: json['isCompleted'] as bool,
        sortOrder: json['sortOrder'] as int? ?? 0,
        task: Task.fromJson(json['task'] as Map<String, dynamic>),
      );
}

class DailyData {
  final String date;
  final List<TaskAssignment> assignments;
  final List<TaskAssignment> overdueTasks;
  final String noteContent;

  const DailyData({
    required this.date,
    required this.assignments,
    required this.overdueTasks,
    required this.noteContent,
  });

  factory DailyData.fromJson(Map<String, dynamic> json) => DailyData(
        date: json['date'] as String,
        assignments: (json['assignments'] as List)
            .map((e) => TaskAssignment.fromJson(e as Map<String, dynamic>))
            .toList(),
        overdueTasks: (json['overdueTasks'] as List)
            .map((e) => TaskAssignment.fromJson(e as Map<String, dynamic>))
            .toList(),
        noteContent: json['noteContent'] as String? ?? '',
      );
}

class TaskStatus {
  final String value;
  final String label;
  final int color;

  const TaskStatus(this.value, this.label, this.color);

  static const List<TaskStatus> all = [
    TaskStatus('inbox', '暫記', 0xFF8A8578),
    TaskStatus('backlog', '待排入', 0xFF7A8B9C),
    TaskStatus('in_progress', '自己處理中', 0xFF5A9BC5),
    TaskStatus('waiting', '等待他人', 0xFF9A7B4F),
    TaskStatus('done', '完成', 0xFF5A7050),
    TaskStatus('archived', '已封存', 0xFF6B6560),
  ];

  static TaskStatus fromValue(String value) =>
      all.firstWhere((s) => s.value == value, orElse: () => all[0]);
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/pubspec.yaml mobile/pubspec.lock mobile/lib/features/tasks/models.dart
git commit -m "feat: task data models + 新增 dependencies"
```

---

### Task 2: Tasks Provider

**Files:**
- Create: `mobile/lib/features/tasks/tasks_provider.dart`

- [ ] **Step 1: 建立 tasks_provider.dart**

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../auth/auth_provider.dart';
import 'models.dart';

// 當天任務資料（以日期為 key）
final dailyDataProvider =
    FutureProvider.family<DailyData, String>((ref, date) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.dio.get('/api/daily/$date');
  return DailyData.fromJson(response.data as Map<String, dynamic>);
});

// 週曆圓點（以 weekStart 為 key，格式 "yyyy-MM-dd"）
final weekDotsProvider =
    FutureProvider.family<Set<String>, String>((ref, weekStart) async {
  final apiClient = ref.read(apiClientProvider);
  // weekStart 是週一，weekEnd 是週日
  final start = DateTime.parse(weekStart);
  final end = start.add(const Duration(days: 6));
  final endStr =
      '${end.year}-${end.month.toString().padLeft(2, '0')}-${end.day.toString().padLeft(2, '0')}';
  final response =
      await apiClient.dio.get('/api/daily/week?start=$weekStart&end=$endStr');
  final list = response.data['datesWithTasks'] as List;
  return Set<String>.from(list.cast<String>());
});

// 當前選中的日期
final selectedDateProvider = StateProvider<String>((ref) {
  final now = DateTime.now();
  return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
});

// 任務操作
class TaskActions {
  final ApiClient _api;

  TaskActions(this._api);

  Future<void> createTask(String date, String title) async {
    await _api.dio.post('/api/daily/$date/tasks', data: {
      'title': title,
      'status': 'in_progress',
    });
  }

  Future<void> toggleComplete(
      String date, String assignmentId, String taskId, bool isCompleted) async {
    await _api.dio.patch('/api/daily/$date/tasks', data: {
      'assignmentId': assignmentId,
      'taskId': taskId,
      'isCompleted': isCompleted,
    });
  }

  Future<void> moveToDate(
      String currentDate, String assignmentId, String targetDate) async {
    await _api.dio.patch('/api/daily/$currentDate/tasks', data: {
      'assignmentId': assignmentId,
      'moveToDate': targetDate,
    });
  }

  Future<void> reorder(String date, List<Map<String, dynamic>> order) async {
    await _api.dio.put('/api/daily/$date/tasks/reorder', data: {
      'order': order,
    });
  }

  Future<void> updateStatus(String taskId, String status) async {
    await _api.dio.patch('/api/tasks/$taskId/status', data: {
      'status': status,
    });
  }

  Future<void> updateTitle(String taskId, String title) async {
    await _api.dio.patch('/api/tasks/$taskId', data: {
      'title': title,
    });
  }
}

final taskActionsProvider = Provider<TaskActions>((ref) {
  return TaskActions(ref.read(apiClientProvider));
});
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/tasks/tasks_provider.dart
git commit -m "feat: tasks Riverpod providers + TaskActions"
```

---

### Task 3: Calendar Bar

**Files:**
- Create: `mobile/lib/features/tasks/calendar_bar.dart`

- [ ] **Step 1: 建立 calendar_bar.dart**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'tasks_provider.dart';

class CalendarBar extends ConsumerWidget {
  const CalendarBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(selectedDateProvider);
    final selected = DateTime.parse(selectedDate);

    // 計算週一
    final weekday = selected.weekday; // 1=Mon
    final weekStart = selected.subtract(Duration(days: weekday - 1));
    final weekStartStr = _fmt(weekStart);

    final weekDots = ref.watch(weekDotsProvider(weekStartStr));
    final dots = weekDots.valueOrNull ?? <String>{};

    final dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF2A2825),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          // 上一週
          _navButton(Icons.chevron_left, () {
            final prev = weekStart.subtract(const Duration(days: 7));
            ref.read(selectedDateProvider.notifier).state = _fmt(prev);
          }),

          // 7 天
          ...List.generate(7, (i) {
            final day = weekStart.add(Duration(days: i));
            final dayStr = _fmt(day);
            final isSelected = dayStr == selectedDate;
            final hasTasks = dots.contains(dayStr);

            return Expanded(
              child: GestureDetector(
                onTap: () {
                  ref.read(selectedDateProvider.notifier).state = dayStr;
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? const Color(0xFFD4A574)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (hasTasks && !isSelected)
                        Container(
                          width: 4,
                          height: 4,
                          margin: const EdgeInsets.only(bottom: 2),
                          decoration: const BoxDecoration(
                            color: Color(0xFFD4A574),
                            shape: BoxShape.circle,
                          ),
                        )
                      else
                        const SizedBox(height: 6),
                      Text(
                        dayNames[i],
                        style: TextStyle(
                          fontSize: 11,
                          color: isSelected
                              ? const Color(0xFF1C1B18)
                              : const Color(0xFF8A8578),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${day.day}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight:
                              isSelected ? FontWeight.bold : FontWeight.w500,
                          color: isSelected
                              ? const Color(0xFF1C1B18)
                              : const Color(0xFFEBE5D4),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),

          // 下一週
          _navButton(Icons.chevron_right, () {
            final next = weekStart.add(const Duration(days: 7));
            ref.read(selectedDateProvider.notifier).state = _fmt(next);
          }),

          // 分隔線
          Container(
            width: 1,
            height: 20,
            margin: const EdgeInsets.symmetric(horizontal: 4),
            color: const Color(0xFF3A3835),
          ),

          // 今天按鈕
          GestureDetector(
            onTap: () {
              ref.read(selectedDateProvider.notifier).state =
                  _fmt(DateTime.now());
            },
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Text(
                '今天',
                style: TextStyle(fontSize: 13, color: Color(0xFFEBE5D4)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _navButton(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: Icon(icon, size: 18, color: const Color(0xFF8A8578)),
      ),
    );
  }

  static String _fmt(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/tasks/calendar_bar.dart
git commit -m "feat: 週曆 bar（日期切換、圓點標記）"
```

---

### Task 4: Task Card + Status Picker

**Files:**
- Create: `mobile/lib/features/tasks/task_card.dart`
- Create: `mobile/lib/features/tasks/task_status_picker.dart`

- [ ] **Step 1: 建立 task_status_picker.dart**

```dart
import 'package:flutter/material.dart';
import 'models.dart';

class TaskStatusPicker extends StatelessWidget {
  final String currentStatus;
  final ValueChanged<String> onSelected;

  const TaskStatusPicker({
    super.key,
    required this.currentStatus,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: TaskStatus.all.map((status) {
            final isSelected = status.value == currentStatus;
            return ListTile(
              leading: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: Color(status.color),
                  shape: BoxShape.circle,
                ),
              ),
              title: Text(
                status.label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  color: isSelected
                      ? const Color(0xFFD4A574)
                      : const Color(0xFFEBE5D4),
                ),
              ),
              trailing: isSelected
                  ? const Icon(Icons.check, size: 18, color: Color(0xFFD4A574))
                  : null,
              onTap: () {
                Navigator.pop(context);
                onSelected(status.value);
              },
            );
          }).toList(),
        ),
      ),
    );
  }
}

void showStatusPicker(
    BuildContext context, String current, ValueChanged<String> onSelected) {
  showModalBottomSheet(
    context: context,
    backgroundColor: const Color(0xFF2A2825),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (_) => TaskStatusPicker(
      currentStatus: current,
      onSelected: onSelected,
    ),
  );
}
```

- [ ] **Step 2: 建立 task_card.dart**

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'models.dart';
import 'task_status_picker.dart';

class TaskCard extends StatelessWidget {
  final TaskAssignment assignment;
  final VoidCallback onToggleComplete;
  final ValueChanged<String> onStatusChange;
  final VoidCallback onMoveDate;

  const TaskCard({
    super.key,
    required this.assignment,
    required this.onToggleComplete,
    required this.onStatusChange,
    required this.onMoveDate,
  });

  @override
  Widget build(BuildContext context) {
    final task = assignment.task;
    final isDone = assignment.isCompleted;
    final status = TaskStatus.fromValue(task.status);

    return InkWell(
      onTap: () => context.push('/task/${task.id}'),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        child: Row(
          children: [
            // Checkbox
            GestureDetector(
              onTap: onToggleComplete,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(
                    color: isDone
                        ? const Color(0xFFD4A574)
                        : const Color(0xFF8A8578),
                    width: 2,
                  ),
                  color: isDone ? const Color(0xFFD4A574) : Colors.transparent,
                ),
                child: isDone
                    ? const Icon(Icons.check, size: 14, color: Color(0xFF1C1B18))
                    : null,
              ),
            ),

            const SizedBox(width: 12),

            // Title
            Expanded(
              child: Text(
                task.title,
                style: TextStyle(
                  fontSize: 14,
                  color: isDone
                      ? const Color(0xFF8A8578)
                      : const Color(0xFFEBE5D4),
                  decoration: isDone ? TextDecoration.lineThrough : null,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),

            const SizedBox(width: 8),

            // Description icon
            if (task.description != null && task.description!.isNotEmpty)
              GestureDetector(
                onTap: () => context.push('/task/${task.id}'),
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.description_outlined,
                      size: 16, color: Color(0xFF8A8578)),
                ),
              ),

            // Move date
            GestureDetector(
              onTap: onMoveDate,
              child: const Padding(
                padding: EdgeInsets.all(4),
                child: Icon(Icons.calendar_today_outlined,
                    size: 16, color: Color(0xFF8A8578)),
              ),
            ),

            // Status dot
            GestureDetector(
              onTap: () => showStatusPicker(
                context,
                task.status,
                onStatusChange,
              ),
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: Color(status.color),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/tasks/task_card.dart mobile/lib/features/tasks/task_status_picker.dart
git commit -m "feat: TaskCard + StatusPicker bottom sheet"
```

---

### Task 5: Task Create Input + Task List (with reorder)

**Files:**
- Create: `mobile/lib/features/tasks/task_create_input.dart`
- Create: `mobile/lib/features/tasks/task_list.dart`

- [ ] **Step 1: 建立 task_create_input.dart**

```dart
import 'package:flutter/material.dart';

class TaskCreateInput extends StatefulWidget {
  final ValueChanged<String> onSubmit;

  const TaskCreateInput({super.key, required this.onSubmit});

  @override
  State<TaskCreateInput> createState() => _TaskCreateInputState();
}

class _TaskCreateInputState extends State<TaskCreateInput> {
  final _controller = TextEditingController();

  void _submit() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    widget.onSubmit(text);
    _controller.clear();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 36),
      child: TextField(
        controller: _controller,
        onSubmitted: (_) => _submit(),
        style: const TextStyle(fontSize: 14, color: Color(0xFFEBE5D4)),
        decoration: const InputDecoration(
          hintText: '新增任務',
          hintStyle: TextStyle(color: Color(0xFF6B6560), fontSize: 14),
          border: UnderlineInputBorder(
            borderSide: BorderSide(color: Color(0xFF3A3835)),
          ),
          enabledBorder: UnderlineInputBorder(
            borderSide: BorderSide(color: Color(0xFF3A3835)),
          ),
          focusedBorder: UnderlineInputBorder(
            borderSide: BorderSide(color: Color(0xFFD4A574)),
          ),
          contentPadding: EdgeInsets.symmetric(vertical: 12),
          isDense: true,
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: 建立 task_list.dart**

```dart
import 'package:flutter/material.dart';
import 'models.dart';
import 'task_card.dart';

class TaskList extends StatelessWidget {
  final List<TaskAssignment> assignments;
  final void Function(String assignmentId, String taskId, bool isCompleted)
      onToggleComplete;
  final void Function(String taskId, String status) onStatusChange;
  final void Function(String assignmentId) onMoveDate;
  final void Function(int oldIndex, int newIndex) onReorder;

  const TaskList({
    super.key,
    required this.assignments,
    required this.onToggleComplete,
    required this.onStatusChange,
    required this.onMoveDate,
    required this.onReorder,
  });

  @override
  Widget build(BuildContext context) {
    return ReorderableListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: assignments.length,
      onReorder: onReorder,
      proxyDecorator: (child, index, animation) {
        return Material(
          color: Colors.transparent,
          elevation: 4,
          child: child,
        );
      },
      itemBuilder: (context, index) {
        final a = assignments[index];
        return TaskCard(
          key: ValueKey(a.id),
          assignment: a,
          onToggleComplete: () =>
              onToggleComplete(a.id, a.taskId, !a.isCompleted),
          onStatusChange: (status) => onStatusChange(a.task.id, status),
          onMoveDate: () => onMoveDate(a.id),
        );
      },
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/tasks/task_create_input.dart mobile/lib/features/tasks/task_list.dart
git commit -m "feat: TaskCreateInput + TaskList（含拖曳排序）"
```

---

### Task 6: Overdue Section

**Files:**
- Create: `mobile/lib/features/tasks/overdue_section.dart`

- [ ] **Step 1: 建立 overdue_section.dart**

```dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'models.dart';

class OverdueSection extends StatefulWidget {
  final List<TaskAssignment> overdueTasks;
  final String currentDate;
  final void Function(String assignmentId, String taskId, bool isCompleted)
      onToggleComplete;
  final void Function(String assignmentId, String targetDate) onReschedule;
  final void Function(String assignmentId, String taskId) onArchive;

  const OverdueSection({
    super.key,
    required this.overdueTasks,
    required this.currentDate,
    required this.onToggleComplete,
    required this.onReschedule,
    required this.onArchive,
  });

  @override
  State<OverdueSection> createState() => _OverdueSectionState();
}

class _OverdueSectionState extends State<OverdueSection> {
  late bool _isExpanded;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _isExpanded = now.weekday != 6 && now.weekday != 7; // 六日收合
  }

  @override
  Widget build(BuildContext context) {
    if (widget.overdueTasks.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () => setState(() => _isExpanded = !_isExpanded),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            child: Row(
              children: [
                Icon(
                  _isExpanded ? Icons.expand_more : Icons.chevron_right,
                  size: 18,
                  color: const Color(0xFFD4A574),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.schedule, size: 16, color: Color(0xFFD4A574)),
                const SizedBox(width: 6),
                Text(
                  '前幾天的 (${widget.overdueTasks.length})',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFFD4A574),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_isExpanded)
          ...widget.overdueTasks.map((a) => _buildOverdueItem(a)),
      ],
    );
  }

  Widget _buildOverdueItem(TaskAssignment a) {
    final dateStr = _formatDate(a.date);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
      child: Row(
        children: [
          // Checkbox
          GestureDetector(
            onTap: () => widget.onToggleComplete(a.id, a.taskId, true),
            child: Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(4),
                border:
                    Border.all(color: const Color(0xFF8A8578), width: 2),
              ),
            ),
          ),

          const SizedBox(width: 12),

          // Title + date
          Expanded(
            child: Row(
              children: [
                Flexible(
                  child: Text(
                    a.task.title,
                    style: const TextStyle(
                        fontSize: 14, color: Color(0xFFEBE5D4)),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  dateStr,
                  style: const TextStyle(
                      fontSize: 11, color: Color(0xFF8A8578)),
                ),
              ],
            ),
          ),

          // 排入今天
          GestureDetector(
            onTap: () => widget.onReschedule(a.id, widget.currentDate),
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: Text(
                '排入今天',
                style: TextStyle(fontSize: 11, color: Color(0xFFD4A574)),
              ),
            ),
          ),

          // 日曆
          GestureDetector(
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: DateTime.now(),
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 365)),
              );
              if (picked != null) {
                final fmt =
                    '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                widget.onReschedule(a.id, fmt);
              }
            },
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Icon(Icons.calendar_today_outlined,
                  size: 16, color: Color(0xFF8A8578)),
            ),
          ),

          // 封存
          GestureDetector(
            onTap: () => _confirmArchive(a),
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Icon(Icons.archive_outlined,
                  size: 16, color: Color(0xFF8A8578)),
            ),
          ),
        ],
      ),
    );
  }

  void _confirmArchive(TaskAssignment a) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF2A2825),
        title: const Text('封存任務', style: TextStyle(fontSize: 16)),
        content: Text('確定要封存「${a.task.title}」嗎？',
            style: const TextStyle(fontSize: 14, color: Color(0xFF8A8578))),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              widget.onArchive(a.id, a.taskId);
            },
            child:
                const Text('封存', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
  }

  String _formatDate(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      return DateFormat('M/d').format(d);
    } catch (_) {
      return dateStr;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/tasks/overdue_section.dart
git commit -m "feat: Overdue section（收合、排入今天、封存確認）"
```

---

### Task 7: Task Detail Screen

**Files:**
- Create: `mobile/lib/features/tasks/task_detail_screen.dart`

- [ ] **Step 1: 建立 task_detail_screen.dart**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import '../../core/api_client.dart';
import '../auth/auth_provider.dart';
import 'models.dart';
import 'tasks_provider.dart';
import 'task_status_picker.dart';

final taskDetailProvider =
    FutureProvider.family<Task, String>((ref, taskId) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.dio.get('/api/tasks/$taskId');
  return Task.fromJson(response.data as Map<String, dynamic>);
});

class TaskDetailScreen extends ConsumerStatefulWidget {
  final String taskId;

  const TaskDetailScreen({super.key, required this.taskId});

  @override
  ConsumerState<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends ConsumerState<TaskDetailScreen> {
  bool _isEditingTitle = false;
  late TextEditingController _titleController;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController();
  }

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final taskAsync = ref.watch(taskDetailProvider(widget.taskId));

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1C1B18),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          taskAsync.whenOrNull(
                data: (task) {
                  final status = TaskStatus.fromValue(task.status);
                  return GestureDetector(
                    onTap: () => showStatusPicker(
                      context,
                      task.status,
                      (newStatus) async {
                        await ref
                            .read(taskActionsProvider)
                            .updateStatus(task.id, newStatus);
                        ref.invalidate(taskDetailProvider(widget.taskId));
                      },
                    ),
                    child: Container(
                      margin: const EdgeInsets.only(right: 16),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        border: Border.all(color: Color(status.color)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        status.label,
                        style: TextStyle(
                            fontSize: 12, color: Color(status.color)),
                      ),
                    ),
                  );
                },
              ) ??
              const SizedBox.shrink(),
        ],
      ),
      body: taskAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text('載入失敗', style: TextStyle(color: Colors.grey[400])),
        ),
        data: (task) {
          if (!_isEditingTitle) {
            _titleController.text = task.title;
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title
                _isEditingTitle
                    ? TextField(
                        controller: _titleController,
                        autofocus: true,
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFEBE5D4),
                        ),
                        decoration: const InputDecoration(
                          border: UnderlineInputBorder(
                            borderSide: BorderSide(color: Color(0xFFD4A574)),
                          ),
                          focusedBorder: UnderlineInputBorder(
                            borderSide: BorderSide(color: Color(0xFFD4A574)),
                          ),
                        ),
                        onSubmitted: (value) async {
                          final trimmed = value.trim();
                          if (trimmed.isNotEmpty && trimmed != task.title) {
                            await ref
                                .read(taskActionsProvider)
                                .updateTitle(task.id, trimmed);
                            ref.invalidate(
                                taskDetailProvider(widget.taskId));
                          }
                          setState(() => _isEditingTitle = false);
                        },
                      )
                    : GestureDetector(
                        onTap: () =>
                            setState(() => _isEditingTitle = true),
                        child: Text(
                          task.title,
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFEBE5D4),
                          ),
                        ),
                      ),

                const SizedBox(height: 24),

                // Description (HTML readonly)
                if (task.description != null &&
                    task.description!.isNotEmpty)
                  HtmlWidget(
                    task.description!,
                    textStyle: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFFBBB5A0),
                      height: 1.6,
                    ),
                  )
                else
                  const Text(
                    '沒有內容',
                    style: TextStyle(
                        fontSize: 14,
                        color: Color(0xFF6B6560),
                        fontStyle: FontStyle.italic),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/tasks/task_detail_screen.dart
git commit -m "feat: TaskDetailScreen（title 編輯 + HTML 顯示）"
```

---

### Task 8: Tasks Screen 主畫面組裝

**Files:**
- Rewrite: `mobile/lib/features/tasks/tasks_screen.dart`

- [ ] **Step 1: 重寫 tasks_screen.dart**

讀取現有檔案後替換為：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'tasks_provider.dart';
import 'calendar_bar.dart';
import 'task_create_input.dart';
import 'task_list.dart';
import 'overdue_section.dart';

class TasksScreen extends ConsumerWidget {
  const TasksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(selectedDateProvider);
    final dailyAsync = ref.watch(dailyDataProvider(selectedDate));

    // 日期顯示
    final dateObj = DateTime.parse(selectedDate);
    final dayOfWeek = DateFormat('EEEE').format(dateObj);
    final dateDisplay = DateFormat('M/d, y').format(dateObj);

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    dayOfWeek,
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFFD4A574)),
                  ),
                  Text(
                    dateDisplay,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFEBE5D4),
                    ),
                  ),
                ],
              ),
            ),

            // Calendar bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: const CalendarBar(),
            ),

            // Content
            Expanded(
              child: dailyAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Text('載入失敗',
                      style: TextStyle(color: Colors.grey[400])),
                ),
                data: (data) {
                  // 排序：未完成在前
                  final sorted = [...data.assignments]..sort((a, b) {
                      if (a.isCompleted != b.isCompleted) {
                        return a.isCompleted ? 1 : -1;
                      }
                      return a.sortOrder.compareTo(b.sortOrder);
                    });

                  return RefreshIndicator(
                    onRefresh: () async {
                      ref.invalidate(dailyDataProvider(selectedDate));
                    },
                    child: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      children: [
                        // 新增任務
                        TaskCreateInput(
                          onSubmit: (title) async {
                            await ref
                                .read(taskActionsProvider)
                                .createTask(selectedDate, title);
                            ref.invalidate(dailyDataProvider(selectedDate));
                            ref.invalidate(weekDotsProvider);
                          },
                        ),
                        const SizedBox(height: 8),

                        // Overdue
                        OverdueSection(
                          overdueTasks: data.overdueTasks,
                          currentDate: selectedDate,
                          onToggleComplete:
                              (assignmentId, taskId, isCompleted) async {
                            await ref
                                .read(taskActionsProvider)
                                .toggleComplete(selectedDate, assignmentId,
                                    taskId, isCompleted);
                            ref.invalidate(dailyDataProvider(selectedDate));
                          },
                          onReschedule: (assignmentId, targetDate) async {
                            await ref
                                .read(taskActionsProvider)
                                .moveToDate(
                                    selectedDate, assignmentId, targetDate);
                            ref.invalidate(dailyDataProvider(selectedDate));
                          },
                          onArchive: (assignmentId, taskId) async {
                            await ref
                                .read(taskActionsProvider)
                                .updateStatus(taskId, 'archived');
                            ref.invalidate(dailyDataProvider(selectedDate));
                          },
                        ),

                        // Task list
                        TaskList(
                          assignments: sorted,
                          onToggleComplete:
                              (assignmentId, taskId, isCompleted) async {
                            await ref
                                .read(taskActionsProvider)
                                .toggleComplete(selectedDate, assignmentId,
                                    taskId, isCompleted);
                            ref.invalidate(dailyDataProvider(selectedDate));
                          },
                          onStatusChange: (taskId, status) async {
                            await ref
                                .read(taskActionsProvider)
                                .updateStatus(taskId, status);
                            ref.invalidate(dailyDataProvider(selectedDate));
                          },
                          onMoveDate: (assignmentId) async {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: DateTime.now(),
                              firstDate: DateTime.now(),
                              lastDate: DateTime.now()
                                  .add(const Duration(days: 365)),
                            );
                            if (picked != null) {
                              final fmt =
                                  '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                              await ref
                                  .read(taskActionsProvider)
                                  .moveToDate(
                                      selectedDate, assignmentId, fmt);
                              ref.invalidate(
                                  dailyDataProvider(selectedDate));
                            }
                          },
                          onReorder: (oldIndex, newIndex) async {
                            if (newIndex > oldIndex) newIndex--;
                            final reordered = [...sorted];
                            final item = reordered.removeAt(oldIndex);
                            reordered.insert(newIndex, item);
                            final order = reordered
                                .asMap()
                                .entries
                                .map((e) => {
                                      'id': e.value.id,
                                      'sortOrder': e.key,
                                    })
                                .toList();
                            await ref
                                .read(taskActionsProvider)
                                .reorder(selectedDate, order);
                            ref.invalidate(dailyDataProvider(selectedDate));
                          },
                        ),

                        // 空狀態
                        if (sorted.isEmpty && data.overdueTasks.isEmpty)
                          const Padding(
                            padding: EdgeInsets.only(top: 32),
                            child: Center(
                              child: Text(
                                '今天還沒有任務',
                                style: TextStyle(
                                    fontSize: 14, color: Color(0xFF8A8578)),
                              ),
                            ),
                          ),
                      ],
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
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/features/tasks/tasks_screen.dart
git commit -m "feat: TasksScreen 主畫面組裝"
```

---

### Task 9: Router 加入 Task Detail 路由

**Files:**
- Modify: `mobile/lib/app.dart`

- [ ] **Step 1: 修改 app.dart**

讀取現有檔案。加入 import：

```dart
import 'features/tasks/task_detail_screen.dart';
```

找到 tasks branch 的 GoRoute：

```dart
StatefulShellBranch(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const TasksScreen(),
    ),
  ],
),
```

替換為：

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

- [ ] **Step 2: Commit**

```bash
cd /Users/mike/Documents/nudge
git add mobile/lib/app.dart
git commit -m "feat: 加入 /task/:id 詳細頁路由"
```

---

### Task 10: 驗證

- [ ] **Step 1: Flutter analyze**

```bash
cd /Users/mike/Documents/nudge/mobile
dart analyze
```

預期：無錯誤。

- [ ] **Step 2: 在 simulator 測試**

```bash
flutter run
```

手動測試：
1. 週曆 bar 切換日期 → 任務列表更新
2. 有任務的日期顯示圓點
3. 新增任務 → 列表更新
4. Checkbox 完成/取消
5. 長按拖曳排序
6. 點狀態圓點 → bottom sheet → 切換狀態
7. 點日曆 icon → DatePicker → 移日期
8. Overdue section 收合/展開
9. Overdue 排入今天 / 封存（確認 dialog）
10. 點任務進詳細頁 → title 可編輯 → description HTML 顯示
11. Web 端能看到 App 的操作結果

- [ ] **Step 3: 最終 commit**

```bash
cd /Users/mike/Documents/nudge
git add -A
git commit -m "feat: Phase 3 完成 — 行動（每日任務）"
git push
```

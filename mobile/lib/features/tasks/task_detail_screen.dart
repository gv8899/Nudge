import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
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
  late TextEditingController _titleController;
  late TextEditingController _descController;
  Timer? _saveTimer;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController();
    _descController = TextEditingController();
  }

  @override
  void dispose() {
    _saveTimer?.cancel();
    // Save any pending changes
    _flushSave();
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  void _flushSave() {
    if (!_initialized) return;
    final taskAsync = ref.read(taskDetailProvider(widget.taskId));
    final task = taskAsync.when(data: (t) => t, loading: () => null, error: (_, _) => null);
    if (task == null) return;

    final trimmedTitle = _titleController.text.trim();
    if (trimmedTitle.isNotEmpty && trimmedTitle != task.title) {
      ref.read(taskActionsProvider).updateTitle(task.id, trimmedTitle);
    }

    final text = _descController.text;
    final html = text.trim().isEmpty
        ? ''
        : '<p>${text.replaceAll('\n', '</p><p>')}</p>';
    final currentDesc = _stripHtml(task.description ?? '');
    if (text.trim() != currentDesc.trim()) {
      ref.read(taskActionsProvider).updateDescription(task.id, html);
    }
  }

  void _onDescChanged() {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 800), () {
      final taskAsync = ref.read(taskDetailProvider(widget.taskId));
      final task = taskAsync.when(data: (t) => t, loading: () => null, error: (_, _) => null);
      if (task == null) return;

      final text = _descController.text;
      final html = text.trim().isEmpty
          ? ''
          : '<p>${text.replaceAll('\n', '</p><p>')}</p>';
      ref.read(taskActionsProvider).updateDescription(task.id, html);
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
    final taskAsync = ref.watch(taskDetailProvider(widget.taskId));

    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) {
          _saveTimer?.cancel();
          _flushSave();
          final date = ref.read(selectedDateProvider);
          ref.invalidate(dailyDataProvider(date));
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
          actions: [
            taskAsync.whenOrNull(
                  data: (task) {
                    final status = TaskStatus.fromValue(task.status);
                    return GestureDetector(
                      onTap: () => showStatusPicker(
                        context,
                        task.status,
                        (newStatus) async {
                          await ref.read(taskActionsProvider).updateStatus(task.id, newStatus);
                          ref.invalidate(taskDetailProvider(widget.taskId));
                        },
                      ),
                      child: Container(
                        margin: const EdgeInsets.only(right: 16),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          border: Border.all(color: Color(status.color)),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(status.label, style: TextStyle(fontSize: 12, color: Color(status.color))),
                      ),
                    );
                  },
                ) ??
                const SizedBox.shrink(),
          ],
        ),
        body: taskAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('載入失敗', style: TextStyle(color: Colors.grey[400]))),
          data: (task) {
            // 初始化 controllers（只在第一次載入或 task 變更時）
            if (!_initialized) {
              _titleController.text = task.title;
              _descController.text = _stripHtml(task.description ?? '');
              _initialized = true;
            }

            return SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title — 直接是 TextField，像 Web 一樣
                  TextField(
                    controller: _titleController,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: AppColors.foreground,
                    ),
                    decoration: const InputDecoration(
                      hintText: '任務標題',
                      hintStyle: TextStyle(color: AppColors.textFaint),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                    ),
                    onSubmitted: (value) {
                      final trimmed = value.trim();
                      if (trimmed.isNotEmpty && trimmed != task.title) {
                        ref.read(taskActionsProvider).updateTitle(task.id, trimmed);
                        ref.invalidate(taskDetailProvider(widget.taskId));
                      }
                    },
                  ),

                  const SizedBox(height: 16),
                  Container(height: 1, color: AppColors.border),
                  const SizedBox(height: 16),

                  // Description — 直接是 TextField，自動儲存
                  TextField(
                    controller: _descController,
                    maxLines: null,
                    minLines: 8,
                    onChanged: (_) => _onDescChanged(),
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textMuted,
                      height: 1.8,
                    ),
                    decoration: const InputDecoration(
                      hintText: '輸入內容...',
                      hintStyle: TextStyle(color: AppColors.textFaint),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                    ),
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

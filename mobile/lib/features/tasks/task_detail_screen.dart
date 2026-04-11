import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
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
  bool _isEditingTitle = false;
  late TextEditingController _titleController;
  bool _isEditingDesc = false;
  late TextEditingController _descController;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController();
    _descController = TextEditingController();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final taskAsync = ref.watch(taskDetailProvider(widget.taskId));

    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) {
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
            if (!_isEditingTitle) {
              _titleController.text = task.title;
            }

            return SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _isEditingTitle
                      ? TextField(
                          controller: _titleController,
                          autofocus: true,
                          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.foreground),
                          decoration: const InputDecoration(
                            border: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.primary)),
                            focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.primary)),
                          ),
                          onSubmitted: (value) async {
                            final trimmed = value.trim();
                            if (trimmed.isNotEmpty && trimmed != task.title) {
                              await ref.read(taskActionsProvider).updateTitle(task.id, trimmed);
                              ref.invalidate(taskDetailProvider(widget.taskId));
                            }
                            setState(() => _isEditingTitle = false);
                          },
                        )
                      : Semantics(
                          label: '點擊編輯標題',
                          child: GestureDetector(
                            onTap: () => setState(() => _isEditingTitle = true),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(task.title, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.foreground)),
                                ),
                                const SizedBox(width: 8),
                                const Icon(Icons.edit_outlined, size: 16, color: AppColors.textDim),
                              ],
                            ),
                          ),
                        ),
                  const SizedBox(height: 24),

                  // Description
                  _isEditingDesc
                      ? Column(
                          children: [
                            TextField(
                              controller: _descController,
                              autofocus: true,
                              maxLines: null,
                              style: const TextStyle(fontSize: 14, color: AppColors.textMuted, height: 1.6),
                              decoration: const InputDecoration(
                                hintText: '輸入內容...',
                                hintStyle: TextStyle(color: AppColors.textFaint),
                                border: InputBorder.none,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Align(
                              alignment: Alignment.centerRight,
                              child: TextButton(
                                onPressed: () async {
                                  final text = _descController.text.trim();
                                  final html = text.isEmpty ? '' : '<p>${text.replaceAll('\n', '</p><p>')}</p>';
                                  ref.read(taskActionsProvider).updateDescription(task.id, html);
                                  ref.invalidate(taskDetailProvider(widget.taskId));
                                  setState(() => _isEditingDesc = false);
                                },
                                child: const Text('完成', style: TextStyle(color: AppColors.primary)),
                              ),
                            ),
                          ],
                        )
                      : GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            // Strip HTML to plain text for editing
                            final plainText = task.description
                                    ?.replaceAll(RegExp(r'<[^>]*>'), '')
                                    .replaceAll('&nbsp;', ' ')
                                    .replaceAll('&amp;', '&')
                                    .replaceAll('&lt;', '<')
                                    .replaceAll('&gt;', '>')
                                    .trim() ??
                                '';
                            _descController.text = plainText;
                            setState(() => _isEditingDesc = true);
                          },
                          child: task.description != null && task.description!.isNotEmpty
                              ? HtmlWidget(
                                  task.description!,
                                  textStyle: const TextStyle(fontSize: 14, color: AppColors.textMuted, height: 1.6),
                                )
                              : const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 16),
                                  child: Row(
                                    children: [
                                      Icon(Icons.add, size: 16, color: AppColors.textFaint),
                                      SizedBox(width: 4),
                                      Text('新增內容', style: TextStyle(fontSize: 14, color: AppColors.textFaint)),
                                    ],
                                  ),
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

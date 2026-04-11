import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
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
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFFEBE5D4)),
                        decoration: const InputDecoration(
                          border: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFFD4A574))),
                          focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFFD4A574))),
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
                    : GestureDetector(
                        onTap: () => setState(() => _isEditingTitle = true),
                        child: Text(task.title, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFFEBE5D4))),
                      ),
                const SizedBox(height: 24),
                if (task.description != null && task.description!.isNotEmpty)
                  HtmlWidget(
                    task.description!,
                    textStyle: const TextStyle(fontSize: 14, color: Color(0xFFBBB5A0), height: 1.6),
                  )
                else
                  const Text('沒有內容', style: TextStyle(fontSize: 14, color: Color(0xFF6B6560), fontStyle: FontStyle.italic)),
              ],
            ),
          );
        },
      ),
    );
  }
}

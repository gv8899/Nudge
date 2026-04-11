import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import 'models.dart';
import 'task_status_picker.dart';

class TaskCard extends StatefulWidget {
  final TaskAssignment assignment;
  final VoidCallback onToggleComplete;
  final ValueChanged<String> onStatusChange;
  final VoidCallback onMoveDate;
  final void Function(String taskId, String title)? onTitleChange;
  final void Function(String taskId)? onArchive;

  const TaskCard({
    super.key,
    required this.assignment,
    required this.onToggleComplete,
    required this.onStatusChange,
    required this.onMoveDate,
    this.onTitleChange,
    this.onArchive,
  });

  @override
  State<TaskCard> createState() => _TaskCardState();
}

class _TaskCardState extends State<TaskCard> {
  bool _isEditing = false;
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.assignment.task.title);
  }

  @override
  void didUpdateWidget(TaskCard old) {
    super.didUpdateWidget(old);
    if (!_isEditing && old.assignment.task.title != widget.assignment.task.title) {
      _controller.text = widget.assignment.task.title;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _saveTitle() {
    final trimmed = _controller.text.trim();
    if (trimmed.isEmpty) {
      // Title deleted → archive
      widget.onArchive?.call(widget.assignment.task.id);
    } else if (trimmed != widget.assignment.task.title) {
      widget.onTitleChange?.call(widget.assignment.task.id, trimmed);
    }
    setState(() => _isEditing = false);
  }

  @override
  Widget build(BuildContext context) {
    final task = widget.assignment.task;
    final isDone = widget.assignment.isCompleted;
    final status = TaskStatus.fromValue(task.status);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: Row(
        children: [
          // Checkbox
          Semantics(
            label: isDone ? '取消完成' : '完成任務',
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: widget.onToggleComplete,
              child: SizedBox(
                width: 44,
                height: 44,
                child: Center(
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(
                        color: isDone ? AppColors.primary : AppColors.textDim,
                        width: 2,
                      ),
                      color: isDone ? AppColors.primary : Colors.transparent,
                    ),
                    child: isDone
                        ? const Icon(Icons.check, size: 14, color: AppColors.onPrimary)
                        : null,
                  ),
                ),
              ),
            ),
          ),

          // Title — tap to navigate detail
          Expanded(
            child: _isEditing
                ? TextField(
                    controller: _controller,
                    autofocus: true,
                    style: TextStyle(
                      fontSize: 14,
                      color: isDone ? AppColors.textDim : AppColors.foreground,
                    ),
                    decoration: const InputDecoration(
                      border: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.primary)),
                      focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.primary)),
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(vertical: 10),
                    ),
                    onSubmitted: (_) => _saveTitle(),
                    onTapOutside: (_) => _saveTitle(),
                  )
                : GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => context.push('/task/${task.id}'),
                    onLongPress: () => setState(() => _isEditing = true),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Text(
                        task.title,
                        style: TextStyle(
                          fontSize: 14,
                          color: isDone ? AppColors.textDim : AppColors.foreground,
                          decoration: isDone ? TextDecoration.lineThrough : null,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
          ),

          const SizedBox(width: 4),

          // Detail icon — always visible
          Semantics(
            label: '查看詳情',
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => context.push('/task/${task.id}'),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Icon(
                  Icons.description_outlined,
                  size: 16,
                  color: task.description != null && task.description!.isNotEmpty
                      ? AppColors.foreground
                      : AppColors.textFaint,
                ),
              ),
            ),
          ),

          // Calendar icon
          Semantics(
            label: '移到其他日期',
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: widget.onMoveDate,
              child: const Padding(
                padding: EdgeInsets.all(12),
                child: Icon(Icons.calendar_today_outlined, size: 16, color: AppColors.textDim),
              ),
            ),
          ),

          // Status dot
          Semantics(
            label: '狀態：${status.label}',
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => showStatusPicker(context, task.status, widget.onStatusChange),
              child: Padding(
                padding: const EdgeInsets.all(12),
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
          ),
        ],
      ),
    );
  }
}

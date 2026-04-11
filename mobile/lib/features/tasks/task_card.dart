import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
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

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: Row(
        children: [
          // Checkbox — isolated tap target
          Semantics(
            label: isDone ? '取消完成' : '完成任務',
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onToggleComplete,
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

          // Title — tap to navigate to detail
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => context.push('/task/${task.id}'),
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

          // Description icon
          if (task.description != null && task.description!.isNotEmpty)
            Semantics(
              label: '查看詳情',
              button: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => context.push('/task/${task.id}'),
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Icon(Icons.description_outlined, size: 16, color: AppColors.textDim),
                ),
              ),
            ),

          // Calendar icon
          Semantics(
            label: '移到其他日期',
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onMoveDate,
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
              onTap: () => showStatusPicker(context, task.status, onStatusChange),
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

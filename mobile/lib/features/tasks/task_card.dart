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

  const TaskCard({super.key, required this.assignment, required this.onToggleComplete, required this.onStatusChange, required this.onMoveDate});

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
            GestureDetector(
              onTap: onToggleComplete,
              child: Container(
                width: 20, height: 20,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: isDone ? AppColors.primary : AppColors.textDim, width: 2),
                  color: isDone ? AppColors.primary : Colors.transparent,
                ),
                child: isDone ? const Icon(Icons.check, size: 14, color: AppColors.onPrimary) : null,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(task.title, style: TextStyle(fontSize: 14, color: isDone ? AppColors.textDim : AppColors.foreground, decoration: isDone ? TextDecoration.lineThrough : null), maxLines: 2, overflow: TextOverflow.ellipsis),
            ),
            const SizedBox(width: 8),
            if (task.description != null && task.description!.isNotEmpty)
              GestureDetector(
                onTap: () => context.push('/task/${task.id}'),
                child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.description_outlined, size: 16, color: AppColors.textDim)),
              ),
            GestureDetector(
              onTap: onMoveDate,
              child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.calendar_today_outlined, size: 16, color: AppColors.textDim)),
            ),
            GestureDetector(
              onTap: () => showStatusPicker(context, task.status, onStatusChange),
              child: Padding(padding: const EdgeInsets.all(4), child: Container(width: 10, height: 10, decoration: BoxDecoration(color: Color(status.color), shape: BoxShape.circle))),
            ),
          ],
        ),
      ),
    );
  }
}

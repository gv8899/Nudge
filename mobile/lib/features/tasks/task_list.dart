import 'package:flutter/material.dart';
import 'models.dart';
import 'task_card.dart';

class TaskList extends StatelessWidget {
  final List<TaskAssignment> assignments;
  final void Function(String assignmentId, String taskId, bool isCompleted) onToggleComplete;
  final void Function(String taskId, String status) onStatusChange;
  final void Function(String assignmentId) onMoveDate;
  final void Function(int oldIndex, int newIndex) onReorder;

  const TaskList({super.key, required this.assignments, required this.onToggleComplete, required this.onStatusChange, required this.onMoveDate, required this.onReorder});

  @override
  Widget build(BuildContext context) {
    return ReorderableListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: assignments.length,
      onReorder: onReorder,
      proxyDecorator: (child, index, animation) {
        return Material(color: Colors.transparent, elevation: 4, child: child);
      },
      itemBuilder: (context, index) {
        final a = assignments[index];
        return TaskCard(
          key: ValueKey(a.id),
          assignment: a,
          onToggleComplete: () => onToggleComplete(a.id, a.taskId, !a.isCompleted),
          onStatusChange: (status) => onStatusChange(a.task.id, status),
          onMoveDate: () => onMoveDate(a.id),
        );
      },
    );
  }
}

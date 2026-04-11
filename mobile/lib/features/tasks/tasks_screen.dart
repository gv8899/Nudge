import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
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

    void refreshTasks() {
      ref.invalidate(dailyDataProvider(selectedDate));
    }

    final dateObj = DateTime.parse(selectedDate);
    final dayOfWeek = DateFormat('EEEE').format(dateObj);
    final dateDisplay = DateFormat('M/d, y').format(dateObj);

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(dayOfWeek, style: TextStyle(fontSize: 12, color: AppColors.primary)),
                  Text(dateDisplay, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.foreground)),
                ],
              ),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: CalendarBar(),
            ),
            Expanded(
              child: dailyAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('載入失敗', style: TextStyle(color: Colors.grey[400]))),
                data: (data) {
                  final sorted = [...data.assignments]..sort((a, b) {
                      if (a.isCompleted != b.isCompleted) return a.isCompleted ? 1 : -1;
                      return a.sortOrder.compareTo(b.sortOrder);
                    });

                  return RefreshIndicator(
                    onRefresh: () async {
                      refreshTasks();
                    },
                    child: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      children: [
                        TaskCreateInput(
                          onSubmit: (title) {
                            ref.read(taskActionsProvider).createTask(selectedDate, title);
                            refreshTasks();
                          },
                        ),
                        const SizedBox(height: 8),
                        OverdueSection(
                          overdueTasks: data.overdueTasks,
                          currentDate: selectedDate,
                          onToggleComplete: (assignmentId, taskId, isCompleted) {
                            ref.read(taskActionsProvider).toggleComplete(selectedDate, assignmentId, taskId, isCompleted);
                            refreshTasks();
                          },
                          onReschedule: (assignmentId, targetDate) {
                            ref.read(taskActionsProvider).moveToDate(selectedDate, assignmentId, targetDate);
                            refreshTasks();
                          },
                          onArchive: (assignmentId, taskId) {
                            ref.read(taskActionsProvider).updateStatus(taskId, 'archived');
                            refreshTasks();
                          },
                        ),
                        TaskList(
                          assignments: sorted,
                          onToggleComplete: (assignmentId, taskId, isCompleted) {
                            ref.read(taskActionsProvider).toggleComplete(selectedDate, assignmentId, taskId, isCompleted);
                            refreshTasks();
                          },
                          onStatusChange: (taskId, status) {
                            ref.read(taskActionsProvider).updateStatus(taskId, status);
                            refreshTasks();
                          },
                          onTitleChange: (taskId, title) {
                            ref.read(taskActionsProvider).updateTitle(taskId, title);
                            refreshTasks();
                          },
                          onArchive: (taskId) {
                            ref.read(taskActionsProvider).updateStatus(taskId, 'archived');
                            refreshTasks();
                          },
                          onMoveDate: (assignmentId) async {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: DateTime.now(),
                              firstDate: DateTime.now(),
                              lastDate: DateTime.now().add(const Duration(days: 365)),
                            );
                            if (picked != null) {
                              final fmt = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                              ref.read(taskActionsProvider).moveToDate(selectedDate, assignmentId, fmt);
                              refreshTasks();
                            }
                          },
                          onReorder: (oldIndex, newIndex) {
                            if (newIndex > oldIndex) newIndex--;
                            final reordered = [...sorted];
                            final item = reordered.removeAt(oldIndex);
                            reordered.insert(newIndex, item);
                            final order = reordered.asMap().entries.map((e) => {'id': e.value.id, 'sortOrder': e.key}).toList();
                            ref.read(taskActionsProvider).reorder(selectedDate, order);
                            refreshTasks();
                          },
                        ),
                        if (sorted.isEmpty && data.overdueTasks.isEmpty)
                          Padding(
                            padding: EdgeInsets.only(top: 32),
                            child: Center(child: Text('今天還沒有任務', style: TextStyle(fontSize: 14, color: AppColors.textDim))),
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

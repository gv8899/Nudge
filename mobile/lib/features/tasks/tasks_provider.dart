import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/date_utils.dart';
import '../auth/auth_provider.dart';
import 'models.dart';

final dailyDataProvider =
    FutureProvider.family<DailyData, String>((ref, date) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.dio.get('/api/daily/$date');
  return DailyData.fromJson(response.data as Map<String, dynamic>);
});

final weekDotsProvider =
    FutureProvider.family<Set<String>, String>((ref, weekStart) async {
  final apiClient = ref.read(apiClientProvider);
  final start = DateTime.parse(weekStart);
  final end = start.add(const Duration(days: 6));
  final endStr =
      '${end.year}-${end.month.toString().padLeft(2, '0')}-${end.day.toString().padLeft(2, '0')}';
  final response =
      await apiClient.dio.get('/api/daily/week?start=$weekStart&end=$endStr');
  final list = response.data['datesWithTasks'] as List;
  return Set<String>.from(list.cast<String>());
});

final selectedDateProvider = NotifierProvider<SelectedDateNotifier, String>(
  SelectedDateNotifier.new,
);

class SelectedDateNotifier extends Notifier<String> {
  @override
  String build() => todayStr();

  void setDate(String date) => state = date;
}

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

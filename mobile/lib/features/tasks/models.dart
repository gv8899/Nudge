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

  const TaskStatus(this.value, this.label);

  static const List<TaskStatus> all = [
    TaskStatus('inbox', '暫記'),
    TaskStatus('backlog', '待排入'),
    TaskStatus('in_progress', '自己處理中'),
    TaskStatus('waiting', '等待他人'),
    TaskStatus('done', '完成'),
    TaskStatus('archived', '已封存'),
  ];

  static TaskStatus fromValue(String value) =>
      all.firstWhere((s) => s.value == value, orElse: () => all[0]);
}

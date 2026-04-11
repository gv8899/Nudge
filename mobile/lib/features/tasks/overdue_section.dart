import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import 'models.dart';

class OverdueSection extends StatefulWidget {
  final List<TaskAssignment> overdueTasks;
  final String currentDate;
  final void Function(String assignmentId, String taskId, bool isCompleted) onToggleComplete;
  final void Function(String assignmentId, String targetDate) onReschedule;
  final void Function(String assignmentId, String taskId) onArchive;

  const OverdueSection({super.key, required this.overdueTasks, required this.currentDate, required this.onToggleComplete, required this.onReschedule, required this.onArchive});

  @override
  State<OverdueSection> createState() => _OverdueSectionState();
}

class _OverdueSectionState extends State<OverdueSection> {
  late bool _isExpanded;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _isExpanded = now.weekday != 6 && now.weekday != 7;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.overdueTasks.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () => setState(() => _isExpanded = !_isExpanded),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            child: Row(
              children: [
                Icon(_isExpanded ? Icons.expand_more : Icons.chevron_right, size: 18, color: AppColors.primary),
                const SizedBox(width: 4),
                const Icon(Icons.schedule, size: 16, color: AppColors.primary),
                const SizedBox(width: 6),
                Text('前幾天的 (${widget.overdueTasks.length})', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.primary)),
              ],
            ),
          ),
        ),
        if (_isExpanded) ...widget.overdueTasks.map(_buildItem),
      ],
    );
  }

  Widget _buildItem(TaskAssignment a) {
    final dateStr = _formatDate(a.date);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => widget.onToggleComplete(a.id, a.taskId, true),
            child: Container(width: 20, height: 20, decoration: BoxDecoration(borderRadius: BorderRadius.circular(4), border: Border.all(color: AppColors.textDim, width: 2))),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Row(
              children: [
                Flexible(child: Text(a.task.title, style: const TextStyle(fontSize: 14, color: AppColors.foreground), overflow: TextOverflow.ellipsis)),
                const SizedBox(width: 8),
                Text(dateStr, style: const TextStyle(fontSize: 11, color: AppColors.textDim)),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => widget.onReschedule(a.id, widget.currentDate),
            child: const Padding(padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4), child: Text('排入今天', style: TextStyle(fontSize: 11, color: AppColors.primary))),
          ),
          GestureDetector(
            onTap: () async {
              final picked = await showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
              if (picked != null) {
                final fmt = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                widget.onReschedule(a.id, fmt);
              }
            },
            child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.calendar_today_outlined, size: 16, color: AppColors.textDim)),
          ),
          GestureDetector(
            onTap: () => _confirmArchive(a),
            child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.archive_outlined, size: 16, color: AppColors.textDim)),
          ),
        ],
      ),
    );
  }

  void _confirmArchive(TaskAssignment a) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('封存任務', style: TextStyle(fontSize: 16)),
        content: Text('確定要封存「${a.task.title}」嗎？', style: const TextStyle(fontSize: 14, color: AppColors.textDim)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
          TextButton(onPressed: () { Navigator.pop(ctx); widget.onArchive(a.id, a.taskId); }, child: const Text('封存', style: TextStyle(color: Colors.redAccent))),
        ],
      ),
    );
  }

  String _formatDate(String dateStr) {
    try { return DateFormat('M/d').format(DateTime.parse(dateStr)); } catch (_) { return dateStr; }
  }
}

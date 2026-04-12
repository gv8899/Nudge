import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';
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
    final l = AppL10n.of(context)!;
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
                Icon(_isExpanded ? LucideIcons.chevronDown : LucideIcons.chevronRight, size: 18, color: AppColors.primary),
                const SizedBox(width: 4),
                Icon(LucideIcons.calendarClock, size: 16, color: AppColors.primary),
                const SizedBox(width: 6),
                Text(l.dailyOverdueLabel(widget.overdueTasks.length), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.primary)),
              ],
            ),
          ),
        ),
        if (_isExpanded) ...widget.overdueTasks.map((a) => _buildItem(a, l)),
      ],
    );
  }

  Widget _buildItem(TaskAssignment a, AppL10n l) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: Row(
        children: [
          // Checkbox — same 44px SizedBox as task_card
          Semantics(
            label: l.taskComplete,
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => widget.onToggleComplete(a.id, a.taskId, true),
              child: SizedBox(
                width: 44, height: 44,
                child: Center(
                  child: Container(width: 18, height: 18, decoration: BoxDecoration(borderRadius: BorderRadius.circular(4), border: Border.all(color: AppColors.textDim, width: 2))),
                ),
              ),
            ),
          ),
          // Title
          Expanded(
            child: Text(a.task.title, style: TextStyle(fontSize: 14, color: AppColors.foreground), overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(width: 4),
          // Spacer to align with task_card's fileText icon position (padding 12 + icon 16 + padding 12 = 40)
          const SizedBox(width: 44),
          // Calendar — aligned with task_card's calendar icon
          Semantics(
            label: l.taskMoveToOtherDate,
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () async {
                final picked = await showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)), initialEntryMode: DatePickerEntryMode.calendarOnly);
                if (picked != null) {
                  final fmt = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                  widget.onReschedule(a.id, fmt);
                }
              },
              child: Padding(padding: EdgeInsets.all(12), child: Icon(LucideIcons.calendar, size: 16, color: AppColors.textDim)),
            ),
          ),
          // Archive — match task_card's status dot width (padding 12 + 10px dot + padding 12 = 34)
          Semantics(
            label: l.dailyArchiveTitle,
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => _confirmArchive(a),
              child: SizedBox(
                width: 34,
                height: 44,
                child: Center(child: Icon(LucideIcons.archive, size: 16, color: AppColors.textDim)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _confirmArchive(TaskAssignment a) {
    final l = AppL10n.of(context)!;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text(l.dailyArchiveTitle, style: const TextStyle(fontSize: 16)),
        content: Text(l.dailyArchiveConfirmBody(a.task.title), style: TextStyle(fontSize: 14, color: AppColors.textDim)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l.commonCancel)),
          TextButton(onPressed: () { Navigator.pop(ctx); widget.onArchive(a.id, a.taskId); }, child: Text(l.dailyArchiveButton, style: TextStyle(color: AppColors.destructive))),
        ],
      ),
    );
  }

}

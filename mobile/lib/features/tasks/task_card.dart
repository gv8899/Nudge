import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';
import 'models.dart';

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
    final l = AppL10n.of(context)!;
    final task = widget.assignment.task;
    final isDone = widget.assignment.isCompleted;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: Row(
        children: [
          // Checkbox
          Semantics(
            label: isDone ? l.taskUncomplete : l.taskComplete,
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: widget.onToggleComplete,
              child: SizedBox(
                width: 44,
                height: 44,
                child: Center(
                  child: Container(
                    width: 18,
                    height: 18,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(
                        color: isDone ? AppColors.primary : AppColors.textDim,
                        width: 2,
                      ),
                      color: isDone ? AppColors.primary : Colors.transparent,
                    ),
                    child: isDone
                        ? CustomPaint(
                            size: const Size(10, 8),
                            painter: _CheckmarkPainter(color: AppColors.onPrimary),
                          )
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
                    decoration: InputDecoration(
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
            label: l.taskViewDetails,
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => context.push('/task/${task.id}'),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Icon(
                  LucideIcons.fileText,
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
            label: l.taskMoveToOtherDate,
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: widget.onMoveDate,
              child: Padding(
                padding: EdgeInsets.all(12),
                child: Icon(LucideIcons.calendar, size: 16, color: AppColors.textDim),
              ),
            ),
          ),

        ],
      ),
    );
  }
}

/// Matches Web's SVG checkmark: path="M1 4L3.5 6.5L9 1" in 10×8 viewBox
class _CheckmarkPainter extends CustomPainter {
  final Color color;
  _CheckmarkPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 10;
    final sy = size.height / 8;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    final path = Path()
      ..moveTo(1 * sx, 4 * sy)
      ..lineTo(3.5 * sx, 6.5 * sy)
      ..lineTo(9 * sx, 1 * sy);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

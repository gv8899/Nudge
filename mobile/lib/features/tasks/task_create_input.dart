import 'package:flutter/material.dart';
import '../../core/theme.dart';

class TaskCreateInput extends StatefulWidget {
  final ValueChanged<String> onSubmit;
  const TaskCreateInput({super.key, required this.onSubmit});

  @override
  State<TaskCreateInput> createState() => _TaskCreateInputState();
}

class _TaskCreateInputState extends State<TaskCreateInput> {
  final _controller = TextEditingController();
  bool _isSubmitting = false;

  void _submit() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _isSubmitting) return;
    setState(() => _isSubmitting = true);
    widget.onSubmit(text);
    _controller.clear();
    await Future.delayed(const Duration(milliseconds: 300));
    if (mounted) setState(() => _isSubmitting = false);
  }

  @override
  void dispose() { _controller.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    // Align text and underline with checkbox left edge (4px row padding + 13px checkbox center offset)
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 17),
      child: TextField(
        controller: _controller,
        enabled: !_isSubmitting,
        onSubmitted: (_) => _submit(),
        style: TextStyle(fontSize: 14, color: AppColors.foreground),
        decoration: InputDecoration(
          hintText: '新增任務',
          hintStyle: TextStyle(color: AppColors.textFaint, fontSize: 14),
          border: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.border)),
          enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.border)),
          focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.primary)),
          contentPadding: EdgeInsets.symmetric(vertical: 12),
          isDense: true,
        ),
      ),
    );
  }
}

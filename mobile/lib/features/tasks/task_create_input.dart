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

  void _submit() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    widget.onSubmit(text);
    _controller.clear();
  }

  @override
  void dispose() { _controller.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 36),
      child: TextField(
        controller: _controller,
        onSubmitted: (_) => _submit(),
        style: const TextStyle(fontSize: 14, color: AppColors.foreground),
        decoration: const InputDecoration(
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

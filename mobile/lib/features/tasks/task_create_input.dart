import 'package:flutter/material.dart';

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
        style: const TextStyle(fontSize: 14, color: Color(0xFFEBE5D4)),
        decoration: const InputDecoration(
          hintText: '新增任務',
          hintStyle: TextStyle(color: Color(0xFF6B6560), fontSize: 14),
          border: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF3A3835))),
          enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF3A3835))),
          focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFFD4A574))),
          contentPadding: EdgeInsets.symmetric(vertical: 12),
          isDense: true,
        ),
      ),
    );
  }
}

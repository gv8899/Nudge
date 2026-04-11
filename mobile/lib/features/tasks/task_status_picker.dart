import 'package:flutter/material.dart';
import 'models.dart';

class TaskStatusPicker extends StatelessWidget {
  final String currentStatus;
  final ValueChanged<String> onSelected;

  const TaskStatusPicker({super.key, required this.currentStatus, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: TaskStatus.all.map((status) {
            final isSelected = status.value == currentStatus;
            return ListTile(
              leading: Container(width: 12, height: 12, decoration: BoxDecoration(color: Color(status.color), shape: BoxShape.circle)),
              title: Text(status.label, style: TextStyle(fontSize: 14, fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal, color: isSelected ? const Color(0xFFD4A574) : const Color(0xFFEBE5D4))),
              trailing: isSelected ? const Icon(Icons.check, size: 18, color: Color(0xFFD4A574)) : null,
              onTap: () { Navigator.pop(context); onSelected(status.value); },
            );
          }).toList(),
        ),
      ),
    );
  }
}

void showStatusPicker(BuildContext context, String current, ValueChanged<String> onSelected) {
  showModalBottomSheet(
    context: context,
    backgroundColor: const Color(0xFF2A2825),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
    builder: (_) => TaskStatusPicker(currentStatus: current, onSelected: onSelected),
  );
}

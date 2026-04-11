import 'package:flutter/material.dart';
import '../../core/theme.dart';
import 'models.dart';

class TagColorPicker extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onSelected;

  const TagColorPicker(
      {super.key, required this.selected, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: TagColor.all.map((tc) {
        final isSelected = tc.value == selected;
        return GestureDetector(
          onTap: () => onSelected(tc.value),
          child: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: tc.color,
              shape: BoxShape.circle,
              border: isSelected
                  ? Border.all(color: AppColors.foreground, width: 2)
                  : null,
            ),
          ),
        );
      }).toList(),
    );
  }
}

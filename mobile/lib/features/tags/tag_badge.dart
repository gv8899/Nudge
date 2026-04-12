import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'models.dart';

class TagBadge extends StatelessWidget {
  final String name;
  final String colorToken;
  final VoidCallback? onRemove;

  const TagBadge(
      {super.key, required this.name, required this.colorToken, this.onRemove});

  @override
  Widget build(BuildContext context) {
    final color = TagColor.forToken(context, colorToken);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(name, style: TextStyle(fontSize: 11, color: color)),
          if (onRemove != null) ...[
            const SizedBox(width: 4),
            GestureDetector(
              onTap: onRemove,
              child: Icon(LucideIcons.x, size: 12, color: color),
            ),
          ],
        ],
      ),
    );
  }
}

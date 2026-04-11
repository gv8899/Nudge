import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../tags/tag_badge.dart';
import 'models.dart';

class CardGridItem extends StatelessWidget {
  final CardItem card;
  final VoidCallback onTap;

  const CardGridItem({super.key, required this.card, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final updated = DateFormat('M/d').format(DateTime.parse(card.updatedAt));
    final preview = _stripHtml(card.description, 60);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(card.title,
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.foreground),
                maxLines: 2, overflow: TextOverflow.ellipsis),
            if (preview.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(preview,
                  style: TextStyle(fontSize: 11, color: AppColors.textDim),
                  maxLines: 3, overflow: TextOverflow.ellipsis),
            ],
            if (card.tags.isNotEmpty) ...[
              const SizedBox(height: 6),
              Wrap(
                spacing: 4,
                runSpacing: 4,
                children: card.tags.map((t) => TagBadge(name: t.name, colorToken: t.color)).toList(),
              ),
            ],
            const Spacer(),
            Align(
              alignment: Alignment.centerRight,
              child: Text(updated, style: TextStyle(fontSize: 10, color: AppColors.textDim)),
            ),
          ],
        ),
      ),
    );
  }

  String _stripHtml(String html, int maxLen) {
    final text = html
        .replaceAll(RegExp(r'<[^>]*>'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    if (text.length > maxLen) return '${text.substring(0, maxLen)}…';
    return text;
  }
}

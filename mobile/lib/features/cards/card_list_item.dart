import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../tags/tag_badge.dart';
import 'models.dart';

class CardListItem extends StatelessWidget {
  final CardItem card;
  final VoidCallback onTap;

  const CardListItem({super.key, required this.card, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final preview = _stripHtml(card.description, 100);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(card.title,
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.foreground),
                maxLines: 1, overflow: TextOverflow.ellipsis),
            if (preview.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(preview,
                  style: TextStyle(fontSize: 12, color: AppColors.textDim),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
            if (card.tags.isNotEmpty) ...[
              const SizedBox(height: 6),
              Wrap(
                spacing: 4,
                runSpacing: 4,
                children: card.tags.map((t) => TagBadge(name: t.name, colorToken: t.color)).toList(),
              ),
            ],
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

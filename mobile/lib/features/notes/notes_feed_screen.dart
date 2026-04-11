import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import 'notes_provider.dart';

class NotesFeedScreen extends ConsumerWidget {
  const NotesFeedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feedAsync = ref.watch(notesFeedProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('日誌', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      ),
      body: feedAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('載入失敗', style: TextStyle(color: Colors.grey[400]))),
        data: (notes) {
          if (notes.isEmpty) {
            return const Center(child: Text('還沒有日誌', style: TextStyle(fontSize: 14, color: AppColors.textDim)));
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(notesFeedProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: notes.length,
              separatorBuilder: (_, _) => Container(height: 1, margin: const EdgeInsets.symmetric(vertical: 4), color: AppColors.border),
              itemBuilder: (_, index) {
                final note = notes[index];
                final dateObj = DateTime.parse(note.date);
                final dateStr = '${DateFormat('M/d, y').format(dateObj)} · ${DateFormat('EEEE', 'zh_TW').format(dateObj)}';
                final preview = _stripHtml(note.content, 120);

                return GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    ref.read(selectedNoteDateProvider.notifier).setDate(note.date);
                    Navigator.pop(context);
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(dateStr, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.foreground)),
                        if (preview.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(preview, style: const TextStyle(fontSize: 12, color: AppColors.textDim), maxLines: 2, overflow: TextOverflow.ellipsis),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }

  String _stripHtml(String html, int maxLen) {
    final text = html.replaceAll(RegExp(r'<[^>]*>'), ' ').replaceAll(RegExp(r'\s+'), ' ').trim();
    if (text.length > maxLen) return '${text.substring(0, maxLen)}…';
    return text;
  }
}

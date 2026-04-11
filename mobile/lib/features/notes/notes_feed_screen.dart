import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
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
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('還沒有過去的日記', style: TextStyle(fontSize: 14, color: AppColors.textDim)),
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Text('去今天的日誌', style: TextStyle(fontSize: 13, color: AppColors.primary)),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(notesFeedProvider),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: notes.length,
              itemBuilder: (_, index) {
                final note = notes[index];
                final isLast = index == notes.length - 1;
                return _NoteEntry(
                  note: note,
                  isLast: isLast,
                  onTap: () {
                    ref.read(selectedNoteDateProvider.notifier).setDate(note.date);
                    Navigator.pop(context);
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _NoteEntry extends StatelessWidget {
  final NoteFeedItem note;
  final bool isLast;
  final VoidCallback onTap;

  const _NoteEntry({required this.note, required this.isLast, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final d = DateTime.parse(note.date);
    final dayNum = d.day.toString();
    final month = '${d.month} 月';
    final weekday = DateFormat('EEE', 'zh_TW').format(d);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 時間軸 column
            SizedBox(
              width: 28,
              child: Column(
                children: [
                  // 上方線
                  Container(width: 1, height: 18, color: AppColors.border),
                  // 圓點
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                  // 下方線
                  if (!isLast)
                    Expanded(child: Container(width: 1, color: AppColors.border))
                  else
                    const Expanded(child: SizedBox()),
                ],
              ),
            ),

            const SizedBox(width: 12),

            // 內容
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 日期標題
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          dayNum,
                          style: TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.w900,
                            color: AppColors.primary,
                            height: 1,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Container(width: 1, height: 28, color: AppColors.primary.withValues(alpha: 0.25)),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              month,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.5,
                                color: AppColors.foreground.withValues(alpha: 0.75),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              weekday,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.5,
                                color: AppColors.textDim,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // 內容預覽（HTML render）
                    HtmlWidget(
                      note.content,
                      textStyle: TextStyle(fontSize: 13, color: AppColors.textMuted, height: 1.6),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

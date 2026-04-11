import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../core/date_utils.dart';
import '../../shared/quill_editor_widget.dart';
import 'notes_provider.dart';

class NotesScreen extends ConsumerWidget {
  const NotesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedDate = ref.watch(selectedNoteDateProvider);
    final contentAsync = ref.watch(notesContentProvider(selectedDate));

    final dateObj = DateTime.parse(selectedDate);
    final today = formatDate(DateTime.now());
    final isToday = selectedDate == today;
    final dateLabel = isToday
        ? '${DateFormat('M/d').format(dateObj)} · 今天'
        : '${DateFormat('M/d').format(dateObj)} · ${DateFormat('EEEE', 'zh_TW').format(dateObj)}';

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  Text('日誌', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.foreground)),
                  const Spacer(),
                  Text(dateLabel, style: TextStyle(fontSize: 13, color: AppColors.textDim)),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () => context.push('/notes/feed'),
                    child: Padding(
                      padding: EdgeInsets.all(4),
                      child: Icon(Icons.list, size: 22, color: AppColors.textDim),
                    ),
                  ),
                ],
              ),
            ),

            // Editor
            Expanded(
              child: contentAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('載入失敗', style: TextStyle(color: Colors.grey[400]))),
                data: (html) => QuillEditorWidget(
                  key: ValueKey(selectedDate),
                  initialHtml: html,
                  onChanged: (htmlContent) {
                    ref.read(notesActionsProvider).save(selectedDate, htmlContent);
                  },
                  showToolbar: true,
                  showCodeBlock: false,
                  showListCheck: false,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

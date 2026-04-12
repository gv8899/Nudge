import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme.dart';
import '../../core/date_utils.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/quill_editor_widget.dart';
import 'notes_provider.dart';

class NotesScreen extends ConsumerWidget {
  const NotesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Theme.of(context); // subscribe to theme changes so static AppColors getters re-evaluate
    final l = AppL10n.of(context)!;
    final localeTag = intlLocaleOf(context);
    final selectedDate = ref.watch(selectedNoteDateProvider);
    final contentAsync = ref.watch(notesContentProvider(selectedDate));

    final dateObj = DateTime.parse(selectedDate);
    final today = formatDate(DateTime.now());
    final isToday = selectedDate == today;
    final dateLabel = isToday
        ? '${DateFormat('M/d').format(dateObj)} · ${l.commonToday}'
        : '${DateFormat('M/d').format(dateObj)} · ${DateFormat('EEEE', localeTag).format(dateObj)}';

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  Text(l.navNotes, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.foreground)),
                  const Spacer(),
                  Text(dateLabel, style: TextStyle(fontSize: 13, color: AppColors.textDim)),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () => context.push('/notes/feed'),
                    child: Padding(
                      padding: EdgeInsets.all(4),
                      child: Icon(LucideIcons.edit3, size: 20, color: AppColors.textDim),
                    ),
                  ),
                ],
              ),
            ),

            // Editor
            Expanded(
              child: contentAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text(l.commonLoadFailed, style: TextStyle(color: AppColors.textDim))),
                data: (html) => QuillEditorWidget(
                  key: ValueKey(selectedDate),
                  initialHtml: html,
                  onChanged: (htmlContent) {
                    ref.read(notesActionsProvider).save(selectedDate, htmlContent);
                  },
                  showToolbar: false,
                  showSlashMenu: true,
                  placeholder: l.cardDetailEditorPlaceholder,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

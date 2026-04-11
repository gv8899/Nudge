import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../shared/quill_editor_widget.dart';
import '../tags/models.dart' as tag_models;
import '../tags/tag_badge.dart';
import '../tags/tag_picker.dart';
import '../tags/tags_provider.dart';
import '../tasks/models.dart';
import '../tasks/tasks_provider.dart';
import '../tasks/task_status_picker.dart';
import 'cards_provider.dart';

class CardDetailScreen extends ConsumerStatefulWidget {
  final String taskId;
  const CardDetailScreen({super.key, required this.taskId});

  @override
  ConsumerState<CardDetailScreen> createState() => _CardDetailScreenState();
}

class _CardDetailScreenState extends ConsumerState<CardDetailScreen> {
  late TextEditingController _titleController;
  bool _initialized = false;
  List<String> _selectedTagIds = [];

  // Cached for safe use in dispose()
  String? _lastKnownTitle;
  String? _cardId;
  CardActions? _cardActions;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController();
  }

  @override
  void dispose() {
    _flushSave();
    _titleController.dispose();
    super.dispose();
  }

  void _flushSave() {
    if (!_initialized || _cardId == null || _cardActions == null) return;

    final trimmedTitle = _titleController.text.trim();
    if (trimmedTitle.isNotEmpty && trimmedTitle != _lastKnownTitle) {
      _cardActions!.updateTitle(_cardId!, trimmedTitle);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cardAsync = ref.watch(cardDetailProvider(widget.taskId));

    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) {
          _flushSave();
          // 刷新行動頁和卡片頁
          final date = ref.read(selectedDateProvider);
          ref.invalidate(dailyDataProvider(date));
          ref.invalidate(cardsProvider);
        }
      },
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: AppColors.background,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.pop(context),
          ),
          actions: [
            cardAsync.whenOrNull(
                  data: (card) {
                    final status = TaskStatus.fromValue(card.status);
                    return GestureDetector(
                      onTap: () => showStatusPicker(
                        context,
                        card.status,
                        (newStatus) async {
                          await ref.read(cardActionsProvider).updateTitle(card.id, card.title);
                          await ref.read(taskActionsProvider).updateStatus(card.id, newStatus);
                          ref.invalidate(cardDetailProvider(widget.taskId));
                        },
                      ),
                      child: Container(
                        margin: const EdgeInsets.only(right: 16),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          border: Border.all(color: Color(status.color)),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(status.label, style: TextStyle(fontSize: 12, color: Color(status.color))),
                      ),
                    );
                  },
                ) ??
                const SizedBox.shrink(),
          ],
        ),
        body: cardAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('載入失敗', style: TextStyle(color: Colors.grey[400]))),
          data: (card) {
            if (!_initialized) {
              _titleController.text = card.title;
              _selectedTagIds = card.tags.map((t) => t.id).toList();
              _initialized = true;
            }
            // Cache for safe dispose
            _lastKnownTitle = card.title;
            _cardId = card.id;
            _cardActions = ref.read(cardActionsProvider);

            return SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  TextField(
                    controller: _titleController,
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.foreground),
                    decoration: InputDecoration(
                      hintText: '標題',
                      hintStyle: TextStyle(color: AppColors.textFaint),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                    ),
                    onSubmitted: (value) {
                      final trimmed = value.trim();
                      if (trimmed.isNotEmpty && trimmed != card.title) {
                        ref.read(cardActionsProvider).updateTitle(card.id, trimmed);
                        ref.invalidate(cardDetailProvider(widget.taskId));
                      }
                    },
                  ),

                  const SizedBox(height: 8),

                  // Tags
                  Builder(builder: (context) {
                    final allTags = ref.watch(tagsProvider).when(
                      data: (t) => t,
                      loading: () => <tag_models.Tag>[],
                      error: (_, _) => <tag_models.Tag>[],
                    );
                    final displayTags = _selectedTagIds
                        .map((id) => allTags.where((t) => t.id == id).firstOrNull)
                        .whereType<tag_models.Tag>()
                        .toList();

                    return Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: [
                        ...displayTags.map((t) => TagBadge(
                              name: t.name,
                              colorToken: t.color,
                              onRemove: () {
                                final newIds = _selectedTagIds.where((id) => id != t.id).toList();
                                setState(() => _selectedTagIds = newIds);
                                ref.read(cardActionsProvider).setTags(card.id, newIds);
                              },
                            )),
                        GestureDetector(
                          onTap: () => showTagPicker(
                            context,
                            ref: ref,
                            selectedTagIds: _selectedTagIds,
                            onChanged: (newIds) {
                              setState(() => _selectedTagIds = newIds);
                              ref.read(cardActionsProvider).setTags(card.id, newIds);
                            },
                          ),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(4),
                              color: AppColors.card,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.label_outline, size: 14, color: AppColors.textDim),
                                SizedBox(width: 4),
                                Text('加標籤', style: TextStyle(fontSize: 11, color: AppColors.textDim)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    );
                  }),

                  const SizedBox(height: 16),
                  Container(height: 1, color: AppColors.border),
                  const SizedBox(height: 16),

                  // Description（富文本）
                  SizedBox(
                    height: 300,
                    child: QuillEditorWidget(
                      key: ValueKey('desc-${widget.taskId}'),
                      initialHtml: card.description,
                      onChanged: (html) {
                        ref.read(cardActionsProvider).updateDescription(card.id, html);
                      },
                      showToolbar: true,
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Footer: dates
                  Container(height: 1, color: AppColors.border),
                  const SizedBox(height: 12),
                  Text(
                    '建立 ${DateFormat('yyyy/MM/dd').format(DateTime.parse(card.createdAt))} · 更新 ${DateFormat('yyyy/MM/dd').format(DateTime.parse(card.updatedAt))}',
                    style: TextStyle(fontSize: 11, color: AppColors.textFaint),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

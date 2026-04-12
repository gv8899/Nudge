import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme.dart';
import '../../shared/quill_editor_widget.dart';
import '../tags/models.dart' as tag_models;
import '../tags/tags_provider.dart';
import '../tasks/tasks_provider.dart';
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

  void _showMetadataSheet(dynamic card) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _MetadataSheet(
        card: card,
        selectedTagIds: _selectedTagIds,
        onTagsChanged: (newIds) {
          setState(() => _selectedTagIds = newIds);
          ref.read(cardActionsProvider).setTags(card.id, newIds);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cardAsync = ref.watch(cardDetailProvider(widget.taskId));

    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) {
          _flushSave();
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
            icon: const Icon(LucideIcons.arrowLeft),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        body: cardAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('載入失敗', style: TextStyle(color: AppColors.textDim))),
          data: (card) {
            if (!_initialized) {
              _titleController.text = card.title;
              _selectedTagIds = card.tags.map((t) => t.id).toList();
              _initialized = true;
            }
            _lastKnownTitle = card.title;
            _cardId = card.id;
            _cardActions = ref.read(cardActionsProvider);

            return Column(
              children: [
                // Title + info icon
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 8, 0),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
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
                      ),
                      GestureDetector(
                        onTap: () => _showMetadataSheet(card),
                        behavior: HitTestBehavior.opaque,
                        child: Padding(
                          padding: const EdgeInsets.all(8),
                          child: Icon(LucideIcons.info, size: 18, color: AppColors.textDim),
                        ),
                      ),
                    ],
                  ),
                ),

                // Editor
                Expanded(
                  child: QuillEditorWidget(
                    key: ValueKey('desc-${widget.taskId}'),
                    initialHtml: card.description,
                    onChanged: (html) {
                      ref.read(cardActionsProvider).updateDescription(card.id, html);
                    },
                    showToolbar: false,
                    showSlashMenu: true,
                    placeholder: '輸入 / 開啟格式選單',
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Bottom sheet with inline tag management
class _MetadataSheet extends ConsumerStatefulWidget {
  final dynamic card;
  final List<String> selectedTagIds;
  final ValueChanged<List<String>> onTagsChanged;

  const _MetadataSheet({
    required this.card,
    required this.selectedTagIds,
    required this.onTagsChanged,
  });

  @override
  ConsumerState<_MetadataSheet> createState() => _MetadataSheetState();
}

class _MetadataSheetState extends ConsumerState<_MetadataSheet> {
  late List<String> _tagIds;
  final _newTagController = TextEditingController();
  final _scrollController = ScrollController();
  bool _pickingColor = false;
  String _pendingTagName = '';
  String _pendingColor = 'chart-1';

  @override
  void initState() {
    super.initState();
    _tagIds = [...widget.selectedTagIds];
  }

  @override
  void dispose() {
    _newTagController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _startColorPick(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    setState(() {
      _pickingColor = true;
      _pendingTagName = trimmed;
      _pendingColor = 'chart-1';
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _confirmCreate() async {
    final tag = await ref.read(tagActionsProvider).create(_pendingTagName, color: _pendingColor);
    ref.invalidate(tagsProvider);
    _newTagController.clear();
    setState(() {
      _tagIds.add(tag.id);
      _pickingColor = false;
      _pendingTagName = '';
    });
    widget.onTagsChanged(_tagIds);
  }

  void _toggleTag(String tagId) {
    setState(() {
      if (_tagIds.contains(tagId)) {
        _tagIds.remove(tagId);
      } else {
        _tagIds.add(tagId);
      }
    });
    widget.onTagsChanged(_tagIds);
  }

  @override
  Widget build(BuildContext context) {
    final allTags = ref.watch(tagsProvider).when(
      data: (t) => t,
      loading: () => <tag_models.Tag>[],
      error: (_, _) => <tag_models.Tag>[],
    );

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.6),
        child: SingleChildScrollView(
          controller: _scrollController,
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
            // ── 標籤 ──
            ...allTags.map((tag) {
              final isSelected = _tagIds.contains(tag.id);
              return ListTile(
                leading: Container(width: 12, height: 12, decoration: BoxDecoration(color: tag_models.TagColor.resolve(tag.color), shape: BoxShape.circle)),
                title: Text(tag.name, style: TextStyle(fontSize: 14, color: AppColors.foreground)),
                trailing: isSelected ? Icon(LucideIcons.check, size: 18, color: AppColors.primary) : null,
                onTap: () => _toggleTag(tag.id),
              );
            }),

            // 新增標籤
            if (_pickingColor) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Text('「$_pendingTagName」選擇顏色', style: TextStyle(fontSize: 13, color: AppColors.foreground)),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: tag_models.TagColor.all.map((tc) {
                    final isSelected = tc.value == _pendingColor;
                    return GestureDetector(
                      onTap: () => setState(() => _pendingColor = tc.value),
                      child: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: tc.color,
                          shape: BoxShape.circle,
                          border: isSelected ? Border.all(color: AppColors.primary, width: 2) : null,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => setState(() { _pickingColor = false; _pendingTagName = ''; }),
                      child: Text('取消', style: TextStyle(color: AppColors.textDim)),
                    ),
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: _confirmCreate,
                      child: Text('建立', style: TextStyle(color: AppColors.primary)),
                    ),
                  ],
                ),
              ),
            ] else
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: TextField(
                  controller: _newTagController,
                  style: TextStyle(fontSize: 14, color: AppColors.foreground),
                  decoration: InputDecoration(
                    hintText: '新增標籤...',
                    hintStyle: TextStyle(color: AppColors.textFaint),
                    prefixIcon: Icon(LucideIcons.plus, size: 16, color: AppColors.textDim),
                    prefixIconConstraints: const BoxConstraints(minWidth: 40),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    border: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.border)),
                    enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.border)),
                    focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.primary)),
                  ),
                  onSubmitted: _startColorPick,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

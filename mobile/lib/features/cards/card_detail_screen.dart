import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../tags/tag_badge.dart';
import '../tags/tag_picker.dart';
import 'cards_provider.dart';

class CardDetailScreen extends ConsumerStatefulWidget {
  final String cardId;
  const CardDetailScreen({super.key, required this.cardId});

  @override
  ConsumerState<CardDetailScreen> createState() => _CardDetailScreenState();
}

class _CardDetailScreenState extends ConsumerState<CardDetailScreen> {
  late TextEditingController _titleController;
  late TextEditingController _descController;
  Timer? _saveTimer;
  bool _initialized = false;
  List<String> _selectedTagIds = [];

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController();
    _descController = TextEditingController();
  }

  @override
  void dispose() {
    _saveTimer?.cancel();
    _flushSave();
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  void _flushSave() {
    if (!_initialized) return;
    final cardAsync = ref.read(cardDetailProvider(widget.cardId));
    final card = cardAsync.when(data: (c) => c, loading: () => null, error: (_, _) => null);
    if (card == null) return;

    final trimmedTitle = _titleController.text.trim();
    if (trimmedTitle.isNotEmpty && trimmedTitle != card.title) {
      ref.read(cardActionsProvider).updateTitle(card.id, trimmedTitle);
    }

    final text = _descController.text;
    final html = text.trim().isEmpty ? '' : '<p>${text.replaceAll('\n', '</p><p>')}</p>';
    final currentDesc = _stripHtml(card.description);
    if (text.trim() != currentDesc.trim()) {
      ref.read(cardActionsProvider).updateDescription(card.id, html);
    }
  }

  void _onDescChanged() {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 800), () {
      final cardAsync = ref.read(cardDetailProvider(widget.cardId));
      final card = cardAsync.when(data: (c) => c, loading: () => null, error: (_, _) => null);
      if (card == null) return;

      final text = _descController.text;
      final html = text.trim().isEmpty ? '' : '<p>${text.replaceAll('\n', '</p><p>')}</p>';
      ref.read(cardActionsProvider).updateDescription(card.id, html);
    });
  }

  String _stripHtml(String html) {
    return html
        .replaceAll(RegExp(r'<[^>]*>'), '\n')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll(RegExp(r'\n{3,}'), '\n\n')
        .trim();
  }

  @override
  Widget build(BuildContext context) {
    final cardAsync = ref.watch(cardDetailProvider(widget.cardId));

    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) {
          _saveTimer?.cancel();
          _flushSave();
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
        ),
        body: cardAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('載入失敗', style: TextStyle(color: Colors.grey[400]))),
          data: (card) {
            if (!_initialized) {
              _titleController.text = card.title;
              _descController.text = _stripHtml(card.description);
              _selectedTagIds = card.tags.map((t) => t.id).toList();
              _initialized = true;
            }

            return SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  TextField(
                    controller: _titleController,
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.foreground),
                    decoration: const InputDecoration(
                      hintText: '卡片標題',
                      hintStyle: TextStyle(color: AppColors.textFaint),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                    ),
                    onSubmitted: (value) {
                      final trimmed = value.trim();
                      if (trimmed.isNotEmpty && trimmed != card.title) {
                        ref.read(cardActionsProvider).updateTitle(card.id, trimmed);
                        ref.invalidate(cardDetailProvider(widget.cardId));
                      }
                    },
                  ),

                  const SizedBox(height: 8),

                  // Tags
                  Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: [
                      ...card.tags.map((t) => TagBadge(
                            name: t.name,
                            colorToken: t.color,
                            onRemove: () {
                              final newIds = _selectedTagIds.where((id) => id != t.id).toList();
                              setState(() => _selectedTagIds = newIds);
                              ref.read(cardActionsProvider).setTags(card.id, newIds);
                              ref.invalidate(cardDetailProvider(widget.cardId));
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
                            ref.invalidate(cardDetailProvider(widget.cardId));
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
                            children: const [
                              Icon(Icons.label_outline, size: 14, color: AppColors.textDim),
                              SizedBox(width: 4),
                              Text('加標籤', style: TextStyle(fontSize: 11, color: AppColors.textDim)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),
                  Container(height: 1, color: AppColors.border),
                  const SizedBox(height: 16),

                  // Description
                  TextField(
                    controller: _descController,
                    maxLines: null,
                    minLines: 8,
                    onChanged: (_) => _onDescChanged(),
                    style: const TextStyle(fontSize: 14, color: AppColors.textMuted, height: 1.8),
                    decoration: const InputDecoration(
                      hintText: '輸入內容...',
                      hintStyle: TextStyle(color: AppColors.textFaint),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Footer: dates
                  Container(height: 1, color: AppColors.border),
                  const SizedBox(height: 12),
                  Text(
                    '建立 ${DateFormat('yyyy/MM/dd').format(DateTime.parse(card.createdAt))} · 更新 ${DateFormat('yyyy/MM/dd').format(DateTime.parse(card.updatedAt))}',
                    style: const TextStyle(fontSize: 11, color: AppColors.textFaint),
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

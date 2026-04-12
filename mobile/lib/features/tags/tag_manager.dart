import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';
import 'models.dart';
import 'tags_provider.dart';
import 'tag_color_picker.dart';

class TagManager extends ConsumerStatefulWidget {
  const TagManager({super.key});

  @override
  ConsumerState<TagManager> createState() => _TagManagerState();
}

class _TagManagerState extends ConsumerState<TagManager> {
  final _newNameController = TextEditingController();
  String? _editingId;
  final _editController = TextEditingController();

  @override
  void dispose() {
    _newNameController.dispose();
    _editController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppL10n.of(context)!;
    final tagsAsync = ref.watch(tagsProvider);
    final tags = tagsAsync.when(
        data: (t) => t, loading: () => <Tag>[], error: (_, _) => <Tag>[]);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l.settingsTagsSection,
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: AppColors.textDim)),
        const SizedBox(height: 12),
        ...tags.map((tag) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => _showColorPicker(tag),
                    child: Container(
                        width: 16,
                        height: 16,
                        decoration: BoxDecoration(
                            color: TagColor.forToken(context, tag.color),
                            shape: BoxShape.circle)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _editingId == tag.id
                        ? TextField(
                            controller: _editController,
                            autofocus: true,
                            style: TextStyle(
                                fontSize: 14, color: AppColors.foreground),
                            decoration: InputDecoration(
                                isDense: true,
                                contentPadding:
                                    EdgeInsets.symmetric(vertical: 8),
                                border: UnderlineInputBorder(
                                    borderSide:
                                        BorderSide(color: AppColors.primary)),
                                focusedBorder: UnderlineInputBorder(
                                    borderSide:
                                        BorderSide(color: AppColors.primary))),
                            onSubmitted: (value) async {
                              final trimmed = value.trim();
                              if (trimmed.isNotEmpty && trimmed != tag.name) {
                                await ref
                                    .read(tagActionsProvider)
                                    .update(tag.id, name: trimmed);
                                ref.invalidate(tagsProvider);
                              }
                              setState(() => _editingId = null);
                            },
                            onTapOutside: (_) =>
                                setState(() => _editingId = null),
                          )
                        : GestureDetector(
                            onTap: () {
                              _editController.text = tag.name;
                              setState(() => _editingId = tag.id);
                            },
                            child: Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 8),
                                child: Text(tag.name,
                                    style: TextStyle(
                                        fontSize: 14,
                                        color: AppColors.foreground))),
                          ),
                  ),
                  GestureDetector(
                    onTap: () => _confirmDelete(tag),
                    child: Padding(
                        padding: EdgeInsets.all(8),
                        child: Icon(LucideIcons.trash2,
                            size: 18, color: AppColors.textFaint)),
                  ),
                ],
              ),
            )),
        const SizedBox(height: 8),
        TextField(
          controller: _newNameController,
          style: TextStyle(fontSize: 14, color: AppColors.foreground),
          decoration: InputDecoration(
            hintText: l.tagsNewTagPlaceholder,
            hintStyle: TextStyle(color: AppColors.textFaint),
            isDense: true,
            contentPadding: EdgeInsets.symmetric(vertical: 8),
            border: UnderlineInputBorder(
                borderSide: BorderSide(color: AppColors.border)),
            focusedBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: AppColors.primary)),
          ),
          onSubmitted: (_) => _addTag(),
        ),
      ],
    );
  }

  Future<void> _addTag() async {
    final name = _newNameController.text.trim();
    if (name.isEmpty) return;
    await ref.read(tagActionsProvider).create(name);
    ref.invalidate(tagsProvider);
    _newNameController.clear();
  }

  void _showColorPicker(Tag tag) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: TagColorPicker(
            selected: tag.color,
            onSelected: (color) async {
              Navigator.pop(context);
              await ref
                  .read(tagActionsProvider)
                  .update(tag.id, color: color);
              ref.invalidate(tagsProvider);
            }),
      ),
    );
  }

  void _confirmDelete(Tag tag) {
    final l = AppL10n.of(context)!;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text(l.tagsDeleteTitle, style: const TextStyle(fontSize: 16)),
        content: Text(l.tagsDeleteConfirm(tag.name),
            style: TextStyle(fontSize: 14, color: AppColors.textDim)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(l.commonCancel)),
          TextButton(
              onPressed: () async {
                Navigator.pop(ctx);
                await ref.read(tagActionsProvider).delete(tag.id);
                ref.invalidate(tagsProvider);
              },
              child: Text(l.commonDelete,
                  style: TextStyle(color: AppColors.destructive))),
        ],
      ),
    );
  }
}

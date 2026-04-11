import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import 'models.dart';
import 'tags_provider.dart';
import 'tag_color_picker.dart';

class TagPicker extends ConsumerStatefulWidget {
  final List<String> selectedTagIds;
  final ValueChanged<List<String>> onChanged;

  const TagPicker(
      {super.key, required this.selectedTagIds, required this.onChanged});

  @override
  ConsumerState<TagPicker> createState() => _TagPickerState();
}

class _TagPickerState extends ConsumerState<TagPicker> {
  final _searchController = TextEditingController();
  String _search = '';
  bool _isCreating = false;
  String _newColor = 'chart-1';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _toggle(String tagId) {
    final current = [...widget.selectedTagIds];
    if (current.contains(tagId)) {
      current.remove(tagId);
    } else {
      current.add(tagId);
    }
    widget.onChanged(current);
  }

  Future<void> _createTag() async {
    final name = _searchController.text.trim();
    if (name.isEmpty) return;
    final tag =
        await ref.read(tagActionsProvider).create(name, color: _newColor);
    ref.invalidate(tagsProvider);
    _toggle(tag.id);
    _searchController.clear();
    setState(() {
      _search = '';
      _isCreating = false;
      _newColor = 'chart-1';
    });
  }

  @override
  Widget build(BuildContext context) {
    final tagsAsync = ref.watch(tagsProvider);
    final allTags = tagsAsync.when(
        data: (t) => t,
        loading: () => <Tag>[],
        error: (_, _) => <Tag>[]);
    final filtered = allTags
        .where((t) => t.name.toLowerCase().contains(_search.toLowerCase()))
        .toList();
    final exactMatch =
        allTags.any((t) => t.name.toLowerCase() == _search.toLowerCase());

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _searchController,
              autofocus: true,
              onChanged: (v) => setState(() => _search = v),
              style:
                  TextStyle(fontSize: 14, color: AppColors.foreground),
              decoration: InputDecoration(
                hintText: '搜尋或建立標籤...',
                hintStyle: TextStyle(color: AppColors.textFaint),
                border: UnderlineInputBorder(
                    borderSide: BorderSide(color: AppColors.border)),
                focusedBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: AppColors.primary)),
                isDense: true,
                contentPadding: EdgeInsets.symmetric(vertical: 12),
              ),
            ),
            const SizedBox(height: 8),
            if (_isCreating) ...[
              Text('建立「${_searchController.text.trim()}」',
                  style: TextStyle(
                      fontSize: 13, color: AppColors.foreground)),
              const SizedBox(height: 12),
              TagColorPicker(
                  selected: _newColor,
                  onSelected: (c) => setState(() => _newColor = c)),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                      onPressed: () => setState(() => _isCreating = false),
                      child: Text('取消',
                          style: TextStyle(color: AppColors.textDim))),
                  TextButton(
                      onPressed: _createTag,
                      child: Text('建立',
                          style: TextStyle(color: AppColors.primary))),
                ],
              ),
            ] else ...[
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 250),
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    ...filtered.map((tag) {
                      final isSelected =
                          widget.selectedTagIds.contains(tag.id);
                      return ListTile(
                        dense: true,
                        leading: Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                                color: TagColor.resolve(tag.color),
                                shape: BoxShape.circle)),
                        title: Text(tag.name,
                            style: TextStyle(
                                fontSize: 14,
                                color: AppColors.foreground)),
                        trailing: isSelected
                            ? Icon(Icons.check,
                                size: 18, color: AppColors.primary)
                            : null,
                        onTap: () => _toggle(tag.id),
                      );
                    }),
                    if (_search.trim().isNotEmpty && !exactMatch)
                      ListTile(
                        dense: true,
                        leading: Icon(Icons.add,
                            size: 18, color: AppColors.primary),
                        title: Text('建立「${_search.trim()}」',
                            style: TextStyle(
                                fontSize: 14, color: AppColors.primary)),
                        onTap: () => setState(() => _isCreating = true),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

void showTagPicker(BuildContext context,
    {required WidgetRef ref,
    required List<String> selectedTagIds,
    required ValueChanged<List<String>> onChanged}) {
  showModalBottomSheet(
    context: context,
    backgroundColor: AppColors.card,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
    isScrollControlled: true,
    builder: (_) =>
        TagPicker(selectedTagIds: selectedTagIds, onChanged: onChanged),
  );
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_quill/flutter_quill.dart';
import 'package:flutter_quill_delta_from_html/flutter_quill_delta_from_html.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:vsc_quill_delta_to_html/vsc_quill_delta_to_html.dart';

import '../core/theme.dart';

class QuillEditorWidget extends StatefulWidget {
  const QuillEditorWidget({
    super.key,
    this.initialHtml = '',
    this.onChanged,
    this.showToolbar = true,
    this.readOnly = false,
    this.placeholder,
    this.showCodeBlock = true,
    this.showListCheck = true,
    this.showSlashMenu = false,
  });

  final String initialHtml;
  final ValueChanged<String>? onChanged;
  final bool showToolbar;
  final bool readOnly;
  final String? placeholder;
  final bool showCodeBlock;
  final bool showListCheck;
  final bool showSlashMenu;

  @override
  State<QuillEditorWidget> createState() => _QuillEditorWidgetState();
}

class _QuillEditorWidgetState extends State<QuillEditorWidget> {
  late final QuillController _controller;
  Timer? _debounce;

  // Slash menu state
  bool _showSlash = false;
  String _slashFilter = '';
  int _slashStartOffset = -1;

  @override
  void initState() {
    super.initState();
    _controller = _buildController(widget.initialHtml);
    _controller.addListener(_onDocChange);
  }

  QuillController _buildController(String html) {
    Document doc;
    // 把所有 tag 拿掉後若是空字串（例如 <p></p>、<p><br></p>），就當成空文件，
    // 否則 HtmlToDelta 對空段落可能丟例外而 fallback 成把原始 html 當純文字插入
    final stripped = html.replaceAll(RegExp(r'<[^>]*>'), '').trim();
    if (stripped.isEmpty) {
      doc = Document();
    } else {
      try {
        final converter = HtmlToDelta();
        final delta = converter.convert(html);
        doc = Document.fromDelta(delta);
      } catch (_) {
        doc = Document()..insert(0, stripped);
      }
    }
    return QuillController(
      document: doc,
      selection: const TextSelection.collapsed(offset: 0),
      readOnly: widget.readOnly,
    );
  }

  void _onDocChange() {
    // Debounced HTML export
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 800), () {
      if (!mounted) return;
      final html = _deltaToHtml(_controller.document);
      widget.onChanged?.call(html);
    });

    // Slash menu detection
    if (widget.showSlashMenu) {
      _detectSlash();
    }
  }

  void _detectSlash() {
    final sel = _controller.selection;
    if (!sel.isCollapsed) {
      if (_showSlash) setState(() => _showSlash = false);
      return;
    }

    final offset = sel.baseOffset;
    final doc = _controller.document;
    final docLength = doc.length;

    if (offset <= 0 || offset > docLength) {
      if (_showSlash) setState(() => _showSlash = false);
      return;
    }

    // Find the start of the current line
    final text = doc.toPlainText();
    if (offset > text.length) {
      if (_showSlash) setState(() => _showSlash = false);
      return;
    }

    // Look backwards from cursor to find /
    int lineStart = offset - 1;
    while (lineStart > 0 && text[lineStart - 1] != '\n') {
      lineStart--;
    }

    final lineText = text.substring(lineStart, offset);

    if (lineText.startsWith('/')) {
      final filter = lineText.substring(1);
      if (!_showSlash || _slashFilter != filter) {
        setState(() {
          _showSlash = true;
          _slashFilter = filter;
          _slashStartOffset = lineStart;
        });
      }
    } else {
      if (_showSlash) setState(() => _showSlash = false);
    }
  }

  void _applySlashCommand(_SlashItem item) {
    final offset = _controller.selection.baseOffset;
    final deleteLength = offset - _slashStartOffset;

    // Delete the "/" and any filter text
    _controller.replaceText(_slashStartOffset, deleteLength, '', null);

    // Apply the block attribute
    if (item.attribute != null) {
      _controller.formatSelection(item.attribute!);
    }

    setState(() => _showSlash = false);
  }

  String _deltaToHtml(Document document) {
    final ops = document.toDelta().toJson();
    final converter = QuillDeltaToHtmlConverter(
      List<Map<String, dynamic>>.from(ops),
    );
    return converter.convert();
  }

  @override
  void didUpdateWidget(covariant QuillEditorWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.readOnly != oldWidget.readOnly) {
      _controller.readOnly = widget.readOnly;
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.removeListener(_onDocChange);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (widget.showToolbar && !widget.readOnly)
          Container(
            decoration: BoxDecoration(
              color: AppColors.card,
              border: Border(
                bottom: BorderSide(color: AppColors.border, width: 1),
              ),
            ),
            child: QuillSimpleToolbar(
              controller: _controller,
              config: QuillSimpleToolbarConfig(
                showBoldButton: false,
                showItalicButton: false,
                showHeaderStyle: true,
                headerStyleType: HeaderStyleType.buttons,
                buttonOptions: QuillSimpleToolbarButtonOptions(
                  selectHeaderStyleButtons: QuillToolbarSelectHeaderStyleButtonsOptions(
                    attributes: const [
                      Attribute.h1,
                      Attribute.h2,
                      Attribute.h3,
                      Attribute.header,
                    ],
                  ),
                ),
                showListNumbers: true,
                showListBullets: true,
                showListCheck: widget.showListCheck,
                showCodeBlock: widget.showCodeBlock,
                showInlineCode: false,
                showUnderLineButton: false,
                showStrikeThrough: false,
                showFontFamily: false,
                showFontSize: false,
                showColorButton: false,
                showBackgroundColorButton: false,
                showClearFormat: false,
                showAlignmentButtons: false,
                showLeftAlignment: false,
                showCenterAlignment: false,
                showRightAlignment: false,
                showJustifyAlignment: false,
                showQuote: true,
                showLink: false,
                showSearchButton: false,
                showSubscript: false,
                showSuperscript: false,
                showIndent: false,
                showDividers: false,
                showSmallButton: false,
                showDirection: false,
                showRedo: false,
                showUndo: false,
                multiRowsDisplay: false,
              ),
            ),
          ),
        Expanded(
          child: Stack(
            children: [
              QuillEditor.basic(
                controller: _controller,
                config: QuillEditorConfig(
                  placeholder: widget.placeholder ?? '',
                  padding: const EdgeInsets.all(16),
                  customStyles: DefaultStyles(
                    paragraph: DefaultTextBlockStyle(
                      TextStyle(color: AppColors.foreground, fontSize: 16, height: 1.5),
                      const HorizontalSpacing(0, 0),
                      const VerticalSpacing(0, 8),
                      const VerticalSpacing(0, 0),
                      null,
                    ),
                    placeHolder: DefaultTextBlockStyle(
                      TextStyle(color: AppColors.textFaint, fontSize: 16, height: 1.5),
                      const HorizontalSpacing(0, 0),
                      const VerticalSpacing(0, 0),
                      const VerticalSpacing(0, 0),
                      null,
                    ),
                    h1: DefaultTextBlockStyle(
                      TextStyle(color: AppColors.foreground, fontSize: 28, fontWeight: FontWeight.bold, height: 1.3),
                      const HorizontalSpacing(0, 0),
                      const VerticalSpacing(16, 8),
                      const VerticalSpacing(0, 0),
                      null,
                    ),
                    h2: DefaultTextBlockStyle(
                      TextStyle(color: AppColors.foreground, fontSize: 22, fontWeight: FontWeight.bold, height: 1.3),
                      const HorizontalSpacing(0, 0),
                      const VerticalSpacing(12, 8),
                      const VerticalSpacing(0, 0),
                      null,
                    ),
                    h3: DefaultTextBlockStyle(
                      TextStyle(color: AppColors.foreground, fontSize: 18, fontWeight: FontWeight.bold, height: 1.3),
                      const HorizontalSpacing(0, 0),
                      const VerticalSpacing(8, 8),
                      const VerticalSpacing(0, 0),
                      null,
                    ),
                    lists: DefaultListBlockStyle(
                      TextStyle(color: AppColors.foreground, fontSize: 16, height: 1.5),
                      const HorizontalSpacing(0, 0),
                      const VerticalSpacing(0, 8),
                      const VerticalSpacing(0, 0),
                      null,
                      null,
                    ),
                    quote: DefaultTextBlockStyle(
                      TextStyle(color: AppColors.foreground, fontSize: 16, height: 1.5, fontStyle: FontStyle.italic),
                      const HorizontalSpacing(0, 0),
                      const VerticalSpacing(8, 8),
                      const VerticalSpacing(0, 0),
                      BoxDecoration(
                        border: Border(left: BorderSide(color: AppColors.border, width: 3)),
                      ),
                    ),
                    code: DefaultTextBlockStyle(
                      TextStyle(color: AppColors.foreground, fontSize: 14, fontFamily: 'monospace', height: 1.5),
                      const HorizontalSpacing(0, 0),
                      const VerticalSpacing(8, 8),
                      const VerticalSpacing(0, 0),
                      BoxDecoration(
                        color: AppColors.muted,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    link: TextStyle(color: AppColors.primary, decoration: TextDecoration.underline),
                  ),
                ),
              ),

              // Slash command menu overlay
              if (_showSlash)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: _SlashCommandMenu(
                    filter: _slashFilter,
                    onSelect: _applySlashCommand,
                    onDismiss: () => setState(() => _showSlash = false),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SlashItem {
  final String label;
  final IconData icon;
  final Attribute? attribute;

  const _SlashItem(this.label, this.icon, this.attribute);
}

const _allSlashItems = [
  _SlashItem('Text', LucideIcons.type, Attribute.header),
  _SlashItem('Heading 1', LucideIcons.heading1, Attribute.h1),
  _SlashItem('Heading 2', LucideIcons.heading2, Attribute.h2),
  _SlashItem('Heading 3', LucideIcons.heading3, Attribute.h3),
  _SlashItem('Bullet List', LucideIcons.list, Attribute.ul),
  _SlashItem('Numbered List', LucideIcons.listOrdered, Attribute.ol),
  _SlashItem('To-do List', LucideIcons.listTodo, Attribute.unchecked),
  _SlashItem('Quote', LucideIcons.quote, Attribute.blockQuote),
  _SlashItem('Code Block', LucideIcons.code, Attribute.codeBlock),
];

class _SlashCommandMenu extends StatelessWidget {
  final String filter;
  final ValueChanged<_SlashItem> onSelect;
  final VoidCallback onDismiss;

  const _SlashCommandMenu({
    required this.filter,
    required this.onSelect,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final filtered = filter.isEmpty
        ? _allSlashItems
        : _allSlashItems.where((item) =>
            item.label.toLowerCase().contains(filter.toLowerCase())).toList();

    if (filtered.isEmpty) return const SizedBox.shrink();

    return Container(
      constraints: const BoxConstraints(maxHeight: 320),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border(top: BorderSide(color: AppColors.border, width: 1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Filter hint
          if (filter.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
              child: Row(
                children: [
                  Text('篩選：', style: TextStyle(fontSize: 12, color: AppColors.textDim)),
                  Text(filter, style: TextStyle(fontSize: 12, color: AppColors.primary)),
                ],
              ),
            ),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              padding: const EdgeInsets.symmetric(vertical: 4),
              itemCount: filtered.length,
              itemBuilder: (_, i) {
                final item = filtered[i];
                return GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onSelect(item),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: AppColors.muted,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Icon(item.icon, size: 16, color: AppColors.foreground),
                        ),
                        const SizedBox(width: 12),
                        Text(item.label, style: TextStyle(fontSize: 15, color: AppColors.foreground)),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

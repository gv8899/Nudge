import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_quill/flutter_quill.dart';
import 'package:flutter_quill_delta_from_html/flutter_quill_delta_from_html.dart';
import 'package:vsc_quill_delta_to_html/vsc_quill_delta_to_html.dart';

import '../core/theme.dart';

/// Shared rich-text editor backed by flutter_quill.
///
/// Converts HTML ↔ Quill Delta automatically so the rest of the app
/// only deals with HTML strings (matching the web client).
class QuillEditorWidget extends StatefulWidget {
  const QuillEditorWidget({
    super.key,
    this.initialHtml = '',
    this.onChanged,
    this.showToolbar = true,
    this.readOnly = false,
    this.placeholder,
  });

  final String initialHtml;
  final ValueChanged<String>? onChanged;
  final bool showToolbar;
  final bool readOnly;
  final String? placeholder;

  @override
  State<QuillEditorWidget> createState() => _QuillEditorWidgetState();
}

class _QuillEditorWidgetState extends State<QuillEditorWidget> {
  late final QuillController _controller;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _controller = _buildController(widget.initialHtml);
    _controller.addListener(_onDocChange);
  }

  QuillController _buildController(String html) {
    Document doc;
    if (html.trim().isEmpty) {
      doc = Document();
    } else {
      try {
        final converter = HtmlToDelta();
        final delta = converter.convert(html);
        doc = Document.fromDelta(delta);
      } catch (_) {
        // Fallback: treat as plain text
        doc = Document()..insert(0, html);
      }
    }
    return QuillController(
      document: doc,
      selection: const TextSelection.collapsed(offset: 0),
      readOnly: widget.readOnly,
    );
  }

  void _onDocChange() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 800), () {
      if (!mounted) return;
      final html = _deltaToHtml(_controller.document);
      widget.onChanged?.call(html);
    });
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
              config: const QuillSimpleToolbarConfig(
                showBoldButton: true,
                showItalicButton: true,
                showHeaderStyle: true,
                showListNumbers: true,
                showListBullets: true,
                showListCheck: true,
                showCodeBlock: true,
                showInlineCode: true,
                // Hide buttons we don't need
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
                // clipboard buttons default to false (experimental API)
                showRedo: false,
                showUndo: false,
                multiRowsDisplay: false,
              ),
            ),
          ),
        Expanded(
          child: QuillEditor.basic(
            controller: _controller,
            config: QuillEditorConfig(
              placeholder: widget.placeholder ?? '',
              padding: const EdgeInsets.all(16),
              customStyles: DefaultStyles(
                paragraph: DefaultTextBlockStyle(
                  TextStyle(
                    color: AppColors.foreground,
                    fontSize: 16,
                    height: 1.5,
                  ),
                  const HorizontalSpacing(0, 0),
                  const VerticalSpacing(0, 8),
                  const VerticalSpacing(0, 0),
                  null,
                ),
                h1: DefaultTextBlockStyle(
                  TextStyle(
                    color: AppColors.foreground,
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    height: 1.3,
                  ),
                  const HorizontalSpacing(0, 0),
                  const VerticalSpacing(16, 8),
                  const VerticalSpacing(0, 0),
                  null,
                ),
                h2: DefaultTextBlockStyle(
                  TextStyle(
                    color: AppColors.foreground,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    height: 1.3,
                  ),
                  const HorizontalSpacing(0, 0),
                  const VerticalSpacing(12, 8),
                  const VerticalSpacing(0, 0),
                  null,
                ),
                h3: DefaultTextBlockStyle(
                  TextStyle(
                    color: AppColors.foreground,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    height: 1.3,
                  ),
                  const HorizontalSpacing(0, 0),
                  const VerticalSpacing(8, 8),
                  const VerticalSpacing(0, 0),
                  null,
                ),
                code: DefaultTextBlockStyle(
                  TextStyle(
                    color: AppColors.foreground,
                    fontSize: 14,
                    fontFamily: 'monospace',
                    height: 1.5,
                  ),
                  const HorizontalSpacing(0, 0),
                  const VerticalSpacing(8, 8),
                  const VerticalSpacing(0, 0),
                  BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

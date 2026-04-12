"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, forwardRef, useImperativeHandle } from "react";
import { createEditorExtensions } from "@/components/editor/editor-extensions";
import { useSlashCommandItems } from "@/components/editor/slash-command-items";
import { useBlockDrag } from "@/components/editor/use-block-drag";
import { BlockDragHandle, BlockDropIndicator } from "@/components/editor/block-drag-handle";

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  editable?: boolean;
}

export const TiptapEditor = forwardRef<
  { focus: () => void },
  TiptapEditorProps
>(function TiptapEditor(
  {
    content,
    onChange,
    onBlur,
    placeholder = "",
    autoFocus = false,
    editable = true,
  },
  ref
) {
  const slashItems = useSlashCommandItems();
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions({ placeholder, slashItems }),
    content,
    editable,
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[50vh]",
      },
    },
  });

  const {
    containerRef,
    hoveredBlock,
    dropIndicatorTop,
    containerProps,
    handleDragStart,
    handleDragEnd,
  } = useBlockDrag(editor);

  useImperativeHandle(ref, () => ({
    focus: () => editor?.commands.focus("end"),
  }));

  // 不從 prop 同步回編輯器 — editor 初始化時已帶 content，
  // 之後 editor 是 source of truth。若需切換到不同資料，由 parent 用 key 強制 remount。

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  return (
    <div
      ref={containerRef}
      {...containerProps}
      className="tiptap-container h-full relative"
    >
      {hoveredBlock && (
        <BlockDragHandle
          hoveredBlock={hoveredBlock}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      )}
      {dropIndicatorTop !== null && <BlockDropIndicator top={dropIndicatorTop} />}
      <EditorContent editor={editor} className="h-full" />
    </div>
  );
});

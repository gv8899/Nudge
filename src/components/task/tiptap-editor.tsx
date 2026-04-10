"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, forwardRef, useImperativeHandle } from "react";
import { createEditorExtensions } from "@/components/editor/editor-extensions";

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
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions({ placeholder }),
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
        class: "outline-none min-h-[24px]",
      },
    },
  });

  useImperativeHandle(ref, () => ({
    focus: () => editor?.commands.focus("end"),
  }));

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  return (
    <div className="tiptap-container h-full">
      <EditorContent editor={editor} className="h-full" />
    </div>
  );
});

"use client";

import { useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { createEditorExtensions } from "@/components/editor/editor-extensions";
import { useSlashCommandItems } from "@/components/editor/slash-command-items";
import { useBlockDrag } from "@/components/editor/use-block-drag";
import { BlockDragHandle, BlockDropIndicator } from "@/components/editor/block-drag-handle";

interface NotesCanvasEditorProps {
  date: string;
  initialContent: string;
}

export function NotesCanvasEditor({
  date,
  initialContent,
}: NotesCanvasEditorProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialContent);
  const dateRef = useRef(date);
  const skipUpdateRef = useRef(false);

  dateRef.current = date;

  const slashItems = useSlashCommandItems();
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions({ placeholder: "寫點什麼⋯⋯", slashItems, taskList: false, codeBlock: false }),
    content: initialContent,
    editable: true,
    onUpdate: ({ editor }) => {
      if (skipUpdateRef.current) return;
      const html = editor.getHTML();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (html === lastSavedRef.current) return;
        lastSavedRef.current = html;
        fetch(`/api/daily/${dateRef.current}/notes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: html }),
        });
      }, 800);
    },
    editorProps: {
      attributes: {
        class: "outline-none",
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

  // 只在切換日期時重設內容，SWR revalidation 不該覆蓋正在編輯的文件
  const prevDateRef = useRef(date);
  useEffect(() => {
    if (!editor) return;
    if (prevDateRef.current !== date) {
      prevDateRef.current = date;
      skipUpdateRef.current = true;
      editor.commands.setContent(initialContent);
      skipUpdateRef.current = false;
      lastSavedRef.current = initialContent;
    }
  }, [initialContent, date, editor]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!editor) return;
    const target = e.target as HTMLElement;
    if (target.closest(".tiptap")) return;
    if (target.closest("[data-drag-handle]")) return;
    editor.commands.focus("start");
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      {...containerProps}
      className="relative cursor-text min-h-[60vh] notes-canvas-editor"
    >
      {hoveredBlock && (
        <BlockDragHandle
          hoveredBlock={hoveredBlock}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      )}
      {dropIndicatorTop !== null && <BlockDropIndicator top={dropIndicatorTop} />}
      <div className="tiptap-container">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

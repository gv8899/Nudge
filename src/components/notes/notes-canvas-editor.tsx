"use client";

import { useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "寫點什麼⋯⋯" }),
    ],
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

  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
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
    editor.commands.focus("start");
  };

  return (
    <div
      onClick={handleContainerClick}
      className="cursor-text min-h-[60vh] notes-canvas-editor"
    >
      <div className="tiptap-container">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

"use client";

import { useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

interface DailyNotesProps {
  date: string;
  initialContent: string;
}

export function DailyNotes({ date, initialContent }: DailyNotesProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialContent);
  const dateRef = useRef(date);
  const skipUpdateRef = useRef(false);

  // 保持 dateRef 最新
  dateRef.current = date;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "記錄一下..." }),
    ],
    content: initialContent,
    editable: true,
    onUpdate: ({ editor }) => {
      // 如果是程式觸發的 setContent，跳過存檔
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
        class: "outline-none min-h-[268px]",
      },
    },
  });

  // 切換日期時更新內容
  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      skipUpdateRef.current = true;
      editor.commands.setContent(initialContent);
      skipUpdateRef.current = false;
      lastSavedRef.current = initialContent;
    }
  }, [initialContent, date]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!editor) return;
    const target = e.target as HTMLElement;
    if (target.closest(".tiptap")) return;
    editor.commands.focus("end");
  };

  return (
    <div
      onClick={handleContainerClick}
      className="rounded-lg border border-border-light bg-background min-h-[300px] p-4 cursor-text"
    >
      <div className="tiptap-container">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

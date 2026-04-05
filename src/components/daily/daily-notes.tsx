"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

interface DailyNotesProps {
  date: string;
  initialContent: string;
}

export function DailyNotes({ date, initialContent }: DailyNotesProps) {
  const [content, setContent] = useState(initialContent);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialContent);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "記錄一下..." }),
    ],
    content: initialContent,
    editable: true,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setContent(html);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (html === lastSavedRef.current) return;
        lastSavedRef.current = html;
        fetch(`/api/daily/${date}/notes`, {
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
      editor.commands.setContent(initialContent);
      lastSavedRef.current = initialContent;
    }
  }, [initialContent, date]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // 點擊容器任何地方都聚焦編輯器
  const handleContainerClick = (e: React.MouseEvent) => {
    if (!editor) return;
    // 只有點到容器本身或空白區域時才聚焦
    const target = e.target as HTMLElement;
    if (target.closest(".tiptap")) return;
    editor.commands.focus("end");
  };

  return (
    <div
      onClick={handleContainerClick}
      className="rounded-lg border border-[#555759] bg-[#1e1f22] min-h-[300px] p-4 cursor-text"
    >
      <div className="tiptap-container">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

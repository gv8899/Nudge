"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { GripVertical } from "lucide-react";

interface NotesCanvasEditorProps {
  date: string;
  initialContent: string;
}

interface BlockInfo {
  pos: number;
  top: number;
  height: number;
}

export function NotesCanvasEditor({
  date,
  initialContent,
}: NotesCanvasEditorProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialContent);
  const dateRef = useRef(date);
  const skipUpdateRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBlock, setHoveredBlock] = useState<BlockInfo | null>(null);
  const [draggingFromPos, setDraggingFromPos] = useState<number | null>(null);

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

  // Hover 偵測：滑鼠移動時找到對應的 top-level block
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!editor || !containerRef.current || draggingFromPos !== null) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseY = e.clientY;

      let found: BlockInfo | null = null;
      editor.state.doc.forEach((node, offset) => {
        const dom = editor.view.nodeDOM(offset);
        if (!dom || !(dom instanceof HTMLElement)) return;
        const rect = dom.getBoundingClientRect();
        if (mouseY >= rect.top && mouseY <= rect.bottom) {
          found = {
            pos: offset,
            top: rect.top - containerRect.top,
            height: rect.height,
          };
        }
      });
      setHoveredBlock(found);
    },
    [editor, draggingFromPos]
  );

  const handleMouseLeave = () => {
    if (draggingFromPos === null) setHoveredBlock(null);
  };

  const handleDragStart = (e: React.DragEvent, pos: number) => {
    setDraggingFromPos(pos);
    e.dataTransfer.effectAllowed = "move";
    const img = new Image();
    img.src =
      "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (draggingFromPos === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!editor || draggingFromPos === null) return;
    e.preventDefault();

    // 找到目標 block
    let targetPos: number | null = null;
    editor.state.doc.forEach((node, offset) => {
      const dom = editor.view.nodeDOM(offset);
      if (!dom || !(dom instanceof HTMLElement)) return;
      const rect = dom.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2 && targetPos === null) {
        targetPos = offset;
      }
    });
    if (targetPos === null) {
      targetPos = editor.state.doc.content.size;
    }

    if (targetPos === draggingFromPos) {
      setDraggingFromPos(null);
      return;
    }

    const { state } = editor;
    const sourceNode = state.doc.nodeAt(draggingFromPos);
    if (!sourceNode) {
      setDraggingFromPos(null);
      return;
    }

    const sourceEnd = draggingFromPos + sourceNode.nodeSize;
    const tr = state.tr;
    const sliceCopy = sourceNode.copy(sourceNode.content);

    tr.delete(draggingFromPos, sourceEnd);

    let adjustedTarget = targetPos;
    if (targetPos > draggingFromPos) {
      adjustedTarget = targetPos - sourceNode.nodeSize;
    }

    tr.insert(adjustedTarget, sliceCopy);
    editor.view.dispatch(tr);

    setDraggingFromPos(null);
    setHoveredBlock(null);
  };

  const handleDragEnd = () => {
    setDraggingFromPos(null);
  };

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
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative cursor-text min-h-[60vh] notes-canvas-editor"
    >
      {hoveredBlock && (
        <button
          type="button"
          draggable
          data-drag-handle
          onDragStart={(e) => handleDragStart(e, hoveredBlock.pos)}
          onDragEnd={handleDragEnd}
          className="absolute -left-8 flex items-center justify-center w-6 h-6 rounded text-text-faint hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing transition-colors"
          style={{
            top: hoveredBlock.top + hoveredBlock.height / 2 - 12,
          }}
          aria-label="拖動區塊"
          title="拖動以重新排序"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <div className="tiptap-container">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

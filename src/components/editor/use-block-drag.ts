"use client";

import { useCallback, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { hoveredBlockAt, computeDropSlots, nearestSlot, moveBlock } from "./block-drag-core";
import type { DropSlot } from "./block-drag-core";

// 預先載好 1px 透明圖，避免 dragStart 時圖片還沒 load 導致瀏覽器顯示預設 icon
const emptyDragImage = typeof window !== "undefined" ? (() => {
  const img = new Image();
  img.src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  return img;
})() : null;

export interface BlockInfo {
  pos: number;
  top: number;
  height: number;
}

/**
 * 共用 hook — 為 TipTap 編輯器加入 top-level block 拖放排序。
 *
 * 使用方式：
 * ```tsx
 * const { containerRef, hoveredBlock, containerProps, handleDragStart, handleDragEnd } =
 *   useBlockDrag(editor);
 *
 * return (
 *   <div ref={containerRef} {...containerProps} className="relative">
 *     {hoveredBlock && <DragHandle ... />}
 *     <EditorContent editor={editor} />
 *   </div>
 * );
 * ```
 */
export function useBlockDrag(editor: Editor | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBlock, setHoveredBlock] = useState<BlockInfo | null>(null);
  const [draggingFromPos, setDraggingFromPos] = useState<number | null>(null);
  const [dropIndicatorTop, setDropIndicatorTop] = useState<number | null>(null);
  const slotsRef = useRef<DropSlot[]>([]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!editor || !containerRef.current || draggingFromPos !== null) return;

      // 若滑鼠在 drag handle 本身上方，維持目前 state（避免從文字移到 handle 時消失）
      const target = e.target as HTMLElement;
      if (target.closest("[data-drag-handle]")) return;

      const containerRect = containerRef.current.getBoundingClientRect();

      const hb = hoveredBlockAt(editor.view, e.clientX, e.clientY, containerRect);
      // 曖昧情況（打不到任何頂層 block）回 null，保留既有 state，避免 handle 閃消
      if (hb) setHoveredBlock(hb);
    },
    [editor, draggingFromPos]
  );

  /** 預算所有合法的 drop slot（排除會 no-op 的位置） */
  const computeSlots = useCallback(
    (sourcePos: number): DropSlot[] => {
      if (!editor || !containerRef.current) return [];
      if (!editor.state.doc.nodeAt(sourcePos)) return [];
      return computeDropSlots(editor.view, containerRef.current.getBoundingClientRect());
    },
    [editor]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, pos: number) => {
      setDraggingFromPos(pos);
      e.dataTransfer.effectAllowed = "move";
      if (emptyDragImage) e.dataTransfer.setDragImage(emptyDragImage, 0, 0);

      // 預算所有可放置的 slot
      const slots = computeSlots(pos);
      slotsRef.current = slots;

      // 立即顯示離游標最近的 slot 指示線
      if (slots.length > 0 && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const cursorY = e.clientY - containerRect.top;
        const nearest = nearestSlot(slots, cursorY);
        if (nearest) setDropIndicatorTop(nearest.y);
      }
    },
    [computeSlots]
  );

  /** 從預算好的 slots 中找離游標最近的一個 */
  const findNearestSlot = useCallback(
    (clientY: number): DropSlot | null => {
      const slots = slotsRef.current;
      if (!slots.length || !containerRef.current) return null;
      const containerRect = containerRef.current.getBoundingClientRect();
      const cursorY = clientY - containerRect.top;
      return nearestSlot(slots, cursorY);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (draggingFromPos === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const slot = findNearestSlot(e.clientY);
      if (slot) setDropIndicatorTop(slot.y);
    },
    [draggingFromPos, findNearestSlot]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!editor || draggingFromPos === null) return;
      e.preventDefault();

      const cleanup = () => {
        setDraggingFromPos(null);
        setHoveredBlock(null);
        setDropIndicatorTop(null);
        slotsRef.current = [];
      };

      const slot = findNearestSlot(e.clientY);
      if (!slot) {
        cleanup();
        return;
      }

      moveBlock(editor.view, draggingFromPos, slot.pos);

      cleanup();
    },
    [editor, draggingFromPos, findNearestSlot]
  );

  const handleDragEnd = useCallback(() => {
    setDraggingFromPos(null);
    setDropIndicatorTop(null);
    slotsRef.current = [];
  }, []);

  return {
    containerRef,
    hoveredBlock,
    dropIndicatorTop,
    isDragging: draggingFromPos !== null,
    containerProps: {
      onMouseMove: handleMouseMove,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
    handleDragStart,
    handleDragEnd,
  };
}

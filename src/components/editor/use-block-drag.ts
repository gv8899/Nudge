"use client";

import { useCallback, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";

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
interface DropSlot {
  /** 插入用的 ProseMirror doc position */
  pos: number;
  /** 指示線相對 container 的 y */
  y: number;
}

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

      // 若滑鼠位於編輯器內容左側的 padding 區（drag handle 所在帶狀區），
      // 使用編輯器內容的左邊緣 x 座標來查 pos，避免因為在空白區而清掉 hoveredBlock
      const editorDom = editor.view.dom as HTMLElement;
      const editorRect = editorDom.getBoundingClientRect();
      const probeX =
        e.clientX < editorRect.left ? editorRect.left + 1 : e.clientX;

      const coords = editor.view.posAtCoords({
        left: probeX,
        top: e.clientY,
      });

      // 在曖昧情況（座標打不到任何 node）保留既有 state，避免 handle 閃消
      if (!coords) return;

      const $pos = editor.state.doc.resolve(coords.pos);
      if ($pos.depth < 1) return;

      const topLevelPos = $pos.before(1);
      const dom = editor.view.nodeDOM(topLevelPos);
      if (!dom || !(dom instanceof HTMLElement)) {
        setHoveredBlock(null);
        return;
      }

      const rect = dom.getBoundingClientRect();
      setHoveredBlock({
        pos: topLevelPos,
        top: rect.top - containerRect.top,
        height: rect.height,
      });
    },
    [editor, draggingFromPos]
  );

  const handleMouseLeave = useCallback(() => {
    if (draggingFromPos === null) setHoveredBlock(null);
  }, [draggingFromPos]);

  /** 預算所有合法的 drop slot（排除會 no-op 的位置） */
  const computeSlots = useCallback(
    (sourcePos: number): DropSlot[] => {
      if (!editor || !containerRef.current) return [];
      const doc = editor.state.doc;
      const containerRect = containerRef.current.getBoundingClientRect();
      const sourceNode = doc.nodeAt(sourcePos);
      if (!sourceNode) return [];
      const sourceEnd = sourcePos + sourceNode.nodeSize;

      const slots: DropSlot[] = [];
      let pos = 0;
      const childCount = doc.content.childCount;

      for (let i = 0; i <= childCount; i++) {
        // 算 y：取前後相鄰 block 的邊界做中點
        let y: number;
        if (i === 0) {
          // 第一個 block 上方
          const dom = editor.view.nodeDOM(0);
          y = dom instanceof HTMLElement
            ? dom.getBoundingClientRect().top - containerRect.top
            : 0;
        } else if (i === childCount) {
          // 最後一個 block 下方
          const prevStart = pos - doc.content.child(i - 1).nodeSize;
          const dom = editor.view.nodeDOM(prevStart);
          y = dom instanceof HTMLElement
            ? dom.getBoundingClientRect().bottom - containerRect.top
            : 0;
        } else {
          // 兩個 block 之間：取上方 block 的 bottom 和下方 block 的 top 的中點
          const prevStart = pos - doc.content.child(i - 1).nodeSize;
          const prevDom = editor.view.nodeDOM(prevStart);
          const nextDom = editor.view.nodeDOM(pos);
          if (prevDom instanceof HTMLElement && nextDom instanceof HTMLElement) {
            const above = prevDom.getBoundingClientRect().bottom;
            const below = nextDom.getBoundingClientRect().top;
            y = (above + below) / 2 - containerRect.top;
          } else {
            y = 0;
          }
        }

        slots.push({ pos, y });
        if (i < childCount) pos += doc.content.child(i).nodeSize;
      }

      return slots;
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
        const nearest = slots.reduce((a, b) =>
          Math.abs(a.y - cursorY) <= Math.abs(b.y - cursorY) ? a : b
        );
        setDropIndicatorTop(nearest.y);
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
      return slots.reduce((a, b) =>
        Math.abs(a.y - cursorY) <= Math.abs(b.y - cursorY) ? a : b
      );
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

      const { state } = editor;
      const sourceNode = state.doc.nodeAt(draggingFromPos);
      if (!sourceNode) {
        cleanup();
        return;
      }

      const sourceEnd = draggingFromPos + sourceNode.nodeSize;
      const tr = state.tr;
      tr.delete(draggingFromPos, sourceEnd);

      const adjustedTarget =
        slot.pos > draggingFromPos ? slot.pos - sourceNode.nodeSize : slot.pos;

      tr.insert(adjustedTarget, sourceNode);
      editor.view.dispatch(tr);

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
      onMouseLeave: handleMouseLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
    handleDragStart,
    handleDragEnd,
  };
}

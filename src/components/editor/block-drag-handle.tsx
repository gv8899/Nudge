"use client";

import { GripVertical } from "lucide-react";
import type { BlockInfo } from "./use-block-drag";

interface BlockDragHandleProps {
  hoveredBlock: BlockInfo;
  onDragStart: (e: React.DragEvent, pos: number) => void;
  onDragEnd: () => void;
}

/** 浮動的 grip icon,出現在 hover 到的 top-level block 左側 */
export function BlockDragHandle({
  hoveredBlock,
  onDragStart,
  onDragEnd,
}: BlockDragHandleProps) {
  return (
    <button
      type="button"
      draggable
      data-drag-handle
      onDragStart={(e) => onDragStart(e, hoveredBlock.pos)}
      onDragEnd={onDragEnd}
      className="hidden md:flex absolute left-1 items-center justify-center w-6 h-6 rounded text-text-faint hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing transition-colors z-10"
      style={{
        top: hoveredBlock.top + hoveredBlock.height / 2 - 12,
      }}
      aria-label="拖動區塊"
      title="拖動以重新排序"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

interface BlockDropIndicatorProps {
  top: number;
}

/** 拖移時顯示於目標插入點的水平指示線 */
export function BlockDropIndicator({ top }: BlockDropIndicatorProps) {
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 h-0.5 bg-primary z-20"
      style={{ top: top - 1 }}
    />
  );
}

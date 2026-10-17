// 頂層 block 拖放排序的核心（從 use-block-drag.ts 逐行搬出，不改演算法）。
// Web（use-block-drag.ts React 殼）與 Apple bundle（apple/NudgeEditor/src/block-drag.ts
// 純 DOM 殼）共用。不得 import React。
import type { EditorView } from "@tiptap/pm/view";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { topLevelBlockPos } from "./block-pos";

export interface DropSlot { pos: number; y: number }
export interface HoveredBlock { pos: number; top: number; height: number }

export function hoveredBlockAt(view: EditorView, clientX: number, clientY: number, containerRect: DOMRect): HoveredBlock | null {
  const editorDom = view.dom as HTMLElement;
  const editorRect = editorDom.getBoundingClientRect();
  // 滑鼠在內容左側 padding 區（把手帶）→ 用內容左緣探測，避免清掉 hovered
  const probeX = clientX < editorRect.left ? editorRect.left + 1 : clientX;
  const coords = view.posAtCoords({ left: probeX, top: clientY });
  if (!coords) return null;
  const topLevelPos = topLevelBlockPos(view.state.doc, coords);
  if (topLevelPos === null) return null;
  const dom = view.nodeDOM(topLevelPos);
  if (!dom || !(dom instanceof HTMLElement)) return null;
  const rect = dom.getBoundingClientRect();
  return { pos: topLevelPos, top: rect.top - containerRect.top, height: rect.height };
}

export function computeDropSlots(view: EditorView, containerRect: DOMRect): DropSlot[] {
  const doc = view.state.doc;
  const slots: DropSlot[] = [];
  let pos = 0;
  const childCount = doc.content.childCount;
  for (let i = 0; i <= childCount; i++) {
    let y: number;
    if (i === 0) {
      const dom = view.nodeDOM(0);
      y = dom instanceof HTMLElement ? dom.getBoundingClientRect().top - containerRect.top : 0;
    } else if (i === childCount) {
      const prevStart = pos - doc.content.child(i - 1).nodeSize;
      const dom = view.nodeDOM(prevStart);
      y = dom instanceof HTMLElement ? dom.getBoundingClientRect().bottom - containerRect.top : 0;
    } else {
      const prevStart = pos - doc.content.child(i - 1).nodeSize;
      const prevDom = view.nodeDOM(prevStart);
      const nextDom = view.nodeDOM(pos);
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
}

export function nearestSlot(slots: DropSlot[], cursorY: number): DropSlot | null {
  if (!slots.length) return null;
  return slots.reduce((a, b) => (Math.abs(a.y - cursorY) <= Math.abs(b.y - cursorY) ? a : b));
}

export function buildMoveTransaction(state: EditorState, sourcePos: number, slotPos: number): Transaction | null {
  const sourceNode = state.doc.nodeAt(sourcePos);
  if (!sourceNode || state.doc.resolve(sourcePos).depth !== 0) return null;
  const sourceEnd = sourcePos + sourceNode.nodeSize;
  const tr = state.tr;
  tr.delete(sourcePos, sourceEnd);
  const adjustedTarget = slotPos > sourcePos ? slotPos - sourceNode.nodeSize : slotPos;
  tr.insert(adjustedTarget, sourceNode);
  return tr;
}

export function moveBlock(view: EditorView, sourcePos: number, slotPos: number): boolean {
  const tr = buildMoveTransaction(view.state, sourcePos, slotPos);
  if (!tr) return false;
  view.dispatch(tr);
  return true;
}

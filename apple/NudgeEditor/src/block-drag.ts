// apple/NudgeEditor/src/block-drag.ts
//
// macOS 頂層 block 拖曳把手（純 DOM 殼）。行為逐條對齊 Web 的
// use-block-drag.ts + block-drag-handle.tsx，演算法共用 @web-editor/block-drag-core。
//
// 與檔案拖放（main.ts 的 document Files guard + ProseMirror handleDrop →
// handleFileDrop）互不搶事件：
// - 把手拖曳只 setData("application/x-nudge-block", "1")（自訂 MIME、非文字：拖出 WKWebView
//   到原生標題欄 / 其他 app 也不會插入任何文字），沒有 "Files" type → isFileDrag 為 false，
//   document guard / handleFileDrop 都不理它。
// - 這裡的 dragover / drop 在 draggingFrom === null（例如外部拖檔進來）時什麼都不做，
//   事件照常流到 Files 流程。
// - dragover / drop 掛在 container 的 capture phase：區塊拖曳時先於 ProseMirror
//   preventDefault + stopPropagation。ProseMirror 的 eventBelongsToView 遇到
//   defaultPrevented 直接略過，否則它的預設 drop 會跑 PM 的貼上/拖放解析（若帶了
//   text/plain 就會被當文字插進文件）；stopPropagation 則擋住 prosemirror-dropcursor（直接掛在
//   view.dom 的原生 listener，不看 defaultPrevented），避免和我們的指示線同時出現兩條。
//   document 層的 Files guard 收不到這兩個事件也無妨（非 Files 它本來就不處理）。
import type { Editor } from "@tiptap/core";
import {
  hoveredBlockAt,
  computeDropSlots,
  nearestSlot,
  moveBlock,
  type DropSlot,
  type HoveredBlock,
} from "@web-editor/block-drag-core";

// 預先載好 1px 透明圖，避免 dragstart 時圖還沒 load 而顯示預設拖曳影像。
const EMPTY_IMG = (() => {
  const i = new Image();
  i.src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  return i;
})();

const GRIP_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
  '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/>' +
  '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>' +
  '<circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>';

export interface BlockDragLabels {
  dragBlockTitle?: string;
}

export interface BlockDragHandle {
  destroy(): void;
}

export function mountBlockDrag(
  editor: Editor,
  container: HTMLElement,
  labels: BlockDragLabels = {},
): BlockDragHandle {
  container.classList.add("nudge-has-drag");

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "nudge-drag-handle";
  handle.draggable = true;
  handle.contentEditable = "false";
  handle.setAttribute("aria-label", labels.dragBlockTitle ?? "drag");
  if (labels.dragBlockTitle) handle.title = labels.dragBlockTitle;
  handle.innerHTML = GRIP_SVG;

  const indicator = document.createElement("div");
  indicator.className = "nudge-drop-indicator";

  container.append(handle, indicator);

  let hovered: HoveredBlock | null = null;
  let draggingFrom: number | null = null;
  let slots: DropSlot[] = [];

  const rect = () => container.getBoundingClientRect();
  const showHandle = (hb: HoveredBlock) => {
    hovered = hb;
    handle.style.display = "flex";
    handle.style.top = `${hb.top + hb.height / 2 - 12}px`;
  };
  const hideHandle = () => {
    hovered = null;
    handle.style.display = "none";
  };
  const showIndicator = (y: number) => {
    indicator.style.display = "block";
    indicator.style.top = `${y - 1}px`;
  };
  const hideIndicator = () => {
    indicator.style.display = "none";
  };

  const onMouseMove = (e: MouseEvent) => {
    if (draggingFrom !== null) return;
    // 滑鼠在把手本身上 → 保留（從文字移到把手時不能消失）
    if ((e.target as Element | null)?.closest?.(".nudge-drag-handle")) return;
    const hb = hoveredBlockAt(editor.view, e.clientX, e.clientY, rect());
    // 曖昧（打不到頂層 block）→ null，保留既有狀態避免閃消
    if (hb) showHandle(hb);
  };

  const onMouseLeave = () => {
    if (draggingFrom === null) hideHandle();
  };

  const onDragStart = (e: DragEvent) => {
    if (!hovered || !e.dataTransfer) return;
    if (!editor.state.doc.nodeAt(hovered.pos)) return;
    draggingFrom = hovered.pos;
    e.dataTransfer.effectAllowed = "move";
    // 沒有 "Files" type → isFileDrag false，檔案 drop 流程不會攔到
    // 自訂 MIME（非空值，WebKit 起拖保險）：不是 Files（檔案流程不攔），也不會在拖出視窗時把文字灌進原生欄位
    e.dataTransfer.setData("application/x-nudge-block", "1");
    e.dataTransfer.setDragImage(EMPTY_IMG, 0, 0);
    slots = computeDropSlots(editor.view, rect());
    const s = nearestSlot(slots, e.clientY - rect().top);
    if (s) showIndicator(s.y);
  };

  const onDragOver = (e: DragEvent) => {
    if (draggingFrom === null) return; // 檔案拖入 → 交給 main.ts 的 Files 流程
    e.preventDefault();
    e.stopPropagation(); // capture phase：擋掉 PM / dropcursor
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const s = nearestSlot(slots, e.clientY - rect().top);
    if (s) showIndicator(s.y);
  };

  const cleanup = () => {
    draggingFrom = null;
    slots = [];
    hideIndicator();
    hideHandle();
  };

  const onDrop = (e: DragEvent) => {
    if (draggingFrom === null) return;
    e.preventDefault(); // capture phase：讓 ProseMirror 略過這次 drop
    e.stopPropagation();
    const s = nearestSlot(slots, e.clientY - rect().top);
    if (s) moveBlock(editor.view, draggingFrom, s.pos);
    cleanup();
  };

  const onDragEnd = () => {
    draggingFrom = null;
    slots = [];
    hideIndicator();
  };

  container.addEventListener("mousemove", onMouseMove);
  container.addEventListener("mouseleave", onMouseLeave);
  handle.addEventListener("dragstart", onDragStart);
  handle.addEventListener("dragend", onDragEnd);
  container.addEventListener("dragover", onDragOver, true);
  container.addEventListener("drop", onDrop, true);
  hideHandle();
  hideIndicator();

  return {
    destroy() {
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      handle.removeEventListener("dragstart", onDragStart);
      handle.removeEventListener("dragend", onDragEnd);
      container.removeEventListener("dragover", onDragOver, true);
      container.removeEventListener("drop", onDrop, true);
      handle.remove();
      indicator.remove();
      container.classList.remove("nudge-has-drag");
    },
  };
}

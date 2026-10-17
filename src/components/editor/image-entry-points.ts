// 三個插圖入口（拖檔 / 貼上 / 檔案選擇）的純邏輯。Web（tiptap-editor.tsx）與
// Apple bundle（apple/NudgeEditor/src/main.ts）共用。不得 import React / 用 @/ alias。
import type { EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { isFileDrag, splitImageFiles } from "./file-drag";

export interface EntryPointSink {
  uploadFiles(files: File[], pos: number): void;
  onRejected(): void;
}

/** 把任意 doc 位置換算成「所在頂層區塊之後」的插入點（圖片永遠是頂層區塊）。 */
export function afterTopLevelBlock(doc: PMNode, pos: number): number {
  const $pos = doc.resolve(Math.min(pos, doc.content.size));
  return $pos.depth === 0 ? $pos.pos : $pos.after(1);
}

export function handleFileDrop(view: EditorView, event: DragEvent, sink: EntryPointSink): boolean {
  if (!isFileDrag(event.dataTransfer?.types)) return false;
  // 外部檔案一律攔下，避免瀏覽器 / WKWebView 把頁面導向該檔案。
  event.preventDefault();
  const { images, rejected } = splitImageFiles(event.dataTransfer?.files);
  if (rejected.length > 0) sink.onRejected();
  if (images.length === 0) return true;
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  const pos = coords ? afterTopLevelBlock(view.state.doc, coords.pos) : view.state.doc.content.size;
  sink.uploadFiles(images, pos);
  return true;
}

export function handleFilePaste(view: EditorView, event: ClipboardEvent, sink: EntryPointSink): boolean {
  // 有文字（Excel / Word 等會同時附 PNG 轉譯）→ 交給 ProseMirror 貼文字。
  if (event.clipboardData?.getData("text/plain")) return false;
  const { images, rejected } = splitImageFiles(event.clipboardData?.files);
  if (images.length === 0 && rejected.length === 0) return false;
  event.preventDefault();
  if (rejected.length > 0) sink.onRejected();
  if (images.length === 0) return true;
  sink.uploadFiles(images, afterTopLevelBlock(view.state.doc, view.state.selection.to));
  return true;
}

export function handlePickedFiles(view: EditorView, list: FileList | File[] | null, sink: EntryPointSink): void {
  const { images, rejected } = splitImageFiles(list);
  if (rejected.length > 0) sink.onRejected();
  if (images.length === 0) return;
  sink.uploadFiles(images, afterTopLevelBlock(view.state.doc, view.state.selection.to));
}

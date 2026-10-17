// src/components/editor/image-entry-points.test.ts
import { describe, it, expect, vi } from "vitest";
import { getSchema } from "@tiptap/core";
import { generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import { AttachmentImage } from "./attachment-image";
import { handleFileDrop, handleFilePaste, handlePickedFiles, afterTopLevelBlock } from "./image-entry-points";

const exts = [StarterKit, AttachmentImage];
const schema = getSchema(exts);
const doc = schema.nodeFromJSON(generateJSON("<p>ab</p><p>cd</p>", exts)); // p1 0..4, p2 4..8

function file(type: string, name = "x"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}
function fakeView(posAtCoordsPos: number | null, selectionTo = 2) {
  return {
    state: { doc, selection: { to: selectionTo } },
    posAtCoords: () => (posAtCoordsPos === null ? null : { pos: posAtCoordsPos, inside: -1 }),
  } as unknown as import("@tiptap/pm/view").EditorView;
}
function sink() {
  return { uploadFiles: vi.fn(), onRejected: vi.fn() };
}
function dragEvent(types: string[], files: File[]): DragEvent {
  return {
    dataTransfer: { types, files },
    clientX: 0, clientY: 0,
    preventDefault: vi.fn(),
  } as unknown as DragEvent;
}
function pasteEvent(text: string, files: File[]): ClipboardEvent {
  return {
    clipboardData: { getData: (t: string) => (t === "text/plain" ? text : ""), files },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent;
}

describe("afterTopLevelBlock", () => {
  it("段落內 → 該段之後；頂層位置 → 原位", () => {
    expect(afterTopLevelBlock(doc, 1)).toBe(4);
    expect(afterTopLevelBlock(doc, 5)).toBe(8);
    expect(afterTopLevelBlock(doc, 4)).toBe(4);
    expect(afterTopLevelBlock(doc, 99)).toBe(8);
  });
});

describe("handleFileDrop", () => {
  it("不是檔案拖曳（把手）→ false、不 preventDefault", () => {
    const e = dragEvent(["text/plain"], []);
    const s = sink();
    expect(handleFileDrop(fakeView(1), e, s)).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(s.uploadFiles).not.toHaveBeenCalled();
  });
  it("圖片 → preventDefault、上傳位置在所在段落之後", () => {
    const e = dragEvent(["Files"], [file("image/png")]);
    const s = sink();
    expect(handleFileDrop(fakeView(1), e, s)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(s.uploadFiles).toHaveBeenCalledWith([expect.any(File)], 4);
    expect(s.onRejected).not.toHaveBeenCalled();
  });
  it("只有不支援的檔 → 仍攔下、onRejected、不上傳", () => {
    const e = dragEvent(["Files"], [file("application/pdf")]);
    const s = sink();
    expect(handleFileDrop(fakeView(1), e, s)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(s.onRejected).toHaveBeenCalledTimes(1);
    expect(s.uploadFiles).not.toHaveBeenCalled();
  });
  it("混合 → 上傳支援的、也提示 rejected；座標打不到 → 插在文件最後", () => {
    const e = dragEvent(["Files"], [file("image/jpeg"), file("image/svg+xml")]);
    const s = sink();
    expect(handleFileDrop(fakeView(null), e, s)).toBe(true);
    expect(s.onRejected).toHaveBeenCalledTimes(1);
    expect(s.uploadFiles).toHaveBeenCalledWith([expect.objectContaining({ type: "image/jpeg" })], 8);
  });
});

describe("handleFilePaste", () => {
  it("剪貼簿有文字 → false（交給 ProseMirror 貼文字）", () => {
    const e = pasteEvent("hello", [file("image/png")]);
    expect(handleFilePaste(fakeView(1), e, sink())).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
  it("沒圖也沒 rejected → false", () => {
    expect(handleFilePaste(fakeView(1), pasteEvent("", []), sink())).toBe(false);
  });
  it("純圖 → preventDefault、插在游標段落之後", () => {
    const e = pasteEvent("", [file("image/png")]);
    const s = sink();
    expect(handleFilePaste(fakeView(1, 5), e, s)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(s.uploadFiles).toHaveBeenCalledWith([expect.any(File)], 8);
  });
  it("只有不支援的 → 攔下 + onRejected", () => {
    const e = pasteEvent("", [file("application/pdf")]);
    const s = sink();
    expect(handleFilePaste(fakeView(1), e, s)).toBe(true);
    expect(s.onRejected).toHaveBeenCalledTimes(1);
    expect(s.uploadFiles).not.toHaveBeenCalled();
  });
});

describe("handlePickedFiles", () => {
  it("rejected 提示、支援的上傳在游標段落之後；null 不做事", () => {
    const s = sink();
    handlePickedFiles(fakeView(1, 1), [file("image/webp"), file("text/plain")], s);
    expect(s.onRejected).toHaveBeenCalledTimes(1);
    expect(s.uploadFiles).toHaveBeenCalledWith([expect.objectContaining({ type: "image/webp" })], 4);
    const s2 = sink();
    handlePickedFiles(fakeView(1), null, s2);
    expect(s2.uploadFiles).not.toHaveBeenCalled();
  });
});

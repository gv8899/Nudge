// apple/NudgeEditor/src/main.test.ts
//
// 整個 bundle entry（main.ts）在 jsdom 裡跑一次：驗 macOS 上傳接線。
// - finalize 後 DOM 的 <img src> 是 nudge-attachment scheme（loadFileURL 頁面上
//   /api/attachments/… 會解成 file:/// 破圖），但存出去的 HTML 仍是 server form。
// - 拖檔落在 .ProseMirror 外（#editor 空白）也會上傳，插在文末。
import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Editor } from "@tiptap/core";
import { toServerAttachmentURLs } from "@web-editor/attachment-url";
import { setTestHandler } from "./bridge";

vi.mock("@web-editor/image-prepare", async (orig) => {
  const mod = await orig<typeof import("@web-editor/image-prepare")>();
  return {
    ...mod,
    prepareImageForUpload: vi.fn(async () => ({
      blob: new Blob([new Uint8Array([1, 2])], { type: "image/webp" }),
      mime: "image/webp",
      width: 10,
      height: 20,
    })),
  };
});

interface Api {
  load(html: string): void;
  getHTML(): string;
  setAttachmentTaskId(id: string | null): void;
  uploadResult(r: unknown): boolean;
}

const posted: Array<Record<string, unknown>> = [];
let api: Api;
let editor: Editor;

function fileDrop(target: Element, files: File[]) {
  const e = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(e, "clientX", { value: 0 });
  Object.defineProperty(e, "clientY", { value: 9999 });
  Object.defineProperty(e, "dataTransfer", { value: { types: ["Files"], files, getData: () => "" } });
  target.dispatchEvent(e);
  return e;
}

const png = () => new File([new Uint8Array([137, 80, 78, 71])], "x.png", { type: "image/png" });

beforeAll(async () => {
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => "blob:test";
    URL.revokeObjectURL = () => {};
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (window as unknown as { NUDGE_PLATFORM: string }).NUDGE_PLATFORM = "macos";
  document.body.innerHTML = '<div id="editor"></div>';
  setTestHandler({ postMessage: (m: unknown) => posted.push(m as Record<string, unknown>) });
  await import("./main");
  api = (window as unknown as { NudgeEditor: Api }).NudgeEditor;
  editor = (document.querySelector(".ProseMirror") as unknown as { editor: Editor }).editor;
  // jsdom 沒有 layout：posAtCoords 會丟錯；編輯區外的座標在真機回 null。
  editor.view.posAtCoords = () => null;
  api.setAttachmentTaskId("t1");
});

async function waitForUpload(): Promise<Record<string, unknown>> {
  for (let i = 0; i < 50; i++) {
    const m = posted.find((p) => p.kind === "upload");
    if (m) return m;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("no upload message posted");
}

describe("main.ts (macOS) 上傳接線", () => {
  it("落在 .ProseMirror 外的拖檔也上傳、插在文末；finalize 用 scheme src、存出去是 server form", async () => {
    api.load("<p>a</p><p>b</p>");
    const endBefore = editor.state.doc.content.size;
    const editorEl = document.getElementById("editor")!;
    const e = fileDrop(editorEl, [png()]);
    expect(e.defaultPrevented).toBe(true);

    // placeholder 同步插在原本的文末（sink.uploadFiles(images, doc.content.size)）。
    // （StarterKit 的 trailing node 可能在圖片後再補一個空段落。）
    let imagePos = -1;
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === "image") imagePos = offset;
    });
    expect(imagePos).toBe(endBefore);

    const upload = await waitForUpload();
    expect(upload.taskId).toBe("t1");
    const requestId = upload.requestId as string;

    expect(api.uploadResult({ requestId, ok: true, id: "a1", width: 10, height: 20 })).toBe(true);
    const src = editor.view.dom.querySelector("img")!.getAttribute("src")!;
    expect(src.startsWith("nudge-attachment://")).toBe(true);
    expect(toServerAttachmentURLs(editor.getHTML())).toContain('src="/api/attachments/a1"');
    expect(api.getHTML()).toContain('src="/api/attachments/a1"');
  });

  it("沒有 taskId → 編輯區外的拖檔只吃掉、不插圖", () => {
    api.setAttachmentTaskId(null);
    api.load("<p>a</p>");
    const e = fileDrop(document.getElementById("editor")!, [png()]);
    expect(e.defaultPrevented).toBe(true);
    expect(editor.getHTML()).not.toContain("<img");
    api.setAttachmentTaskId("t1");
  });
});

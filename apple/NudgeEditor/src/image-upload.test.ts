// apple/NudgeEditor/src/image-upload.test.ts
import { describe, it, expect, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { AttachmentImage } from "@web-editor/attachment-image";
import { createUploader } from "./image-upload";

// jsdom 沒有 URL.createObjectURL / revokeObjectURL。
if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:test";
  URL.revokeObjectURL = () => {};
}

function makeEditor() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return new Editor({ element: el, extensions: [StarterKit, AttachmentImage], content: "<p>a</p>" });
}
const png = () => new File([new Uint8Array([137, 80, 78, 71])], "x.png", { type: "image/png" });

describe("createUploader", () => {
  it("插 placeholder → post upload → ok 換成正式圖", async () => {
    const editor = makeEditor();
    const post = vi.fn();
    const onError = vi.fn();
    const up = createUploader({
      editor, getTaskId: () => "t1", post, onError, newId: () => "r1",
      prepare: async () => ({ blob: new Blob([new Uint8Array([1, 2])], { type: "image/webp" }), mime: "image/webp", width: 10, height: 20 }),
    });
    await up.uploadFiles([png()], 3);
    expect(editor.getHTML()).toContain('data-upload-pending="true"');
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ kind: "upload", requestId: "r1", taskId: "t1", mime: "image/webp", width: 10, height: 20 }));
    expect(typeof post.mock.calls[0][0].base64).toBe("string");
    expect(up.pendingCount()).toBe(1);
    expect(up.uploadResult({ requestId: "r1", ok: true, id: "a1", width: 10, height: 20 })).toBe(true);
    expect(editor.getHTML()).toContain('src="/api/attachments/a1"');
    expect(up.pendingCount()).toBe(0);
    expect(onError).not.toHaveBeenCalled();
  });
  it("ok:false → 移除 placeholder + onError", async () => {
    const editor = makeEditor();
    const onError = vi.fn();
    const up = createUploader({
      editor, getTaskId: () => "t1", post: vi.fn(), onError, newId: () => "r2",
      prepare: async () => ({ blob: new Blob([new Uint8Array([1])]), mime: "image/webp", width: 1, height: 1 }),
    });
    await up.uploadFiles([png()], 3);
    expect(up.uploadResult({ requestId: "r2", ok: false, error: "imageTooLarge" })).toBe(true);
    expect(editor.getHTML()).not.toContain("data-upload-pending");
    expect(onError).toHaveBeenCalledWith("imageTooLarge");
  });
  it("prepare 失敗 → 不 post、移除 placeholder、onError(code)", async () => {
    const editor = makeEditor();
    const post = vi.fn();
    const onError = vi.fn();
    const { ImageUploadError } = await import("@web-editor/image-prepare");
    const up = createUploader({
      editor, getTaskId: () => "t1", post, onError, newId: () => "r3",
      prepare: async () => { throw new ImageUploadError("imageUnsupported"); },
    });
    await up.uploadFiles([png()], 3);
    expect(post).not.toHaveBeenCalled();
    expect(editor.getHTML()).not.toContain("data-upload-pending");
    expect(onError).toHaveBeenCalledWith("imageUnsupported");
  });
  it("沒有 taskId → 不做事；未知 requestId 的 uploadResult → false", async () => {
    const editor = makeEditor();
    const post = vi.fn();
    const up = createUploader({ editor, getTaskId: () => null, post, onError: vi.fn(), newId: () => "r4", prepare: async () => { throw new Error("no"); } });
    await up.uploadFiles([png()], 3);
    expect(post).not.toHaveBeenCalled();
    expect(editor.getHTML()).not.toContain("data-upload-pending");
    expect(up.uploadResult({ requestId: "nope", ok: false, error: "x" })).toBe(false);
  });
  it("placeholder 已不在（使用者刪掉）→ uploadResult 回 false 且清掉 pending", async () => {
    const editor = makeEditor();
    const up = createUploader({
      editor, getTaskId: () => "t1", post: vi.fn(), onError: vi.fn(), newId: () => "r5",
      prepare: async () => ({ blob: new Blob([new Uint8Array([1])]), mime: "image/webp", width: 1, height: 1 }),
    });
    await up.uploadFiles([png()], 3);
    editor.commands.setContent("<p>b</p>");
    expect(up.uploadResult({ requestId: "r5", ok: true, id: "a5", width: 1, height: 1 })).toBe(false);
    expect(up.pendingCount()).toBe(0);
  });
  it("多檔：每張各自 requestId，依序插入", async () => {
    const editor = makeEditor();
    const post = vi.fn();
    let n = 0;
    const up = createUploader({
      editor, getTaskId: () => "t1", post, onError: vi.fn(), newId: () => `m${++n}`,
      prepare: async () => ({ blob: new Blob([new Uint8Array([1])]), mime: "image/webp", width: 1, height: 1 }),
    });
    await up.uploadFiles([png(), png()], 3);
    expect(post.mock.calls.map((c) => c[0].requestId)).toEqual(["m1", "m2"]);
    const html = editor.getHTML();
    expect(html.indexOf('data-upload-id="m1"')).toBeLessThan(html.indexOf('data-upload-id="m2"'));
    expect(up.pendingCount()).toBe(2);
  });
});

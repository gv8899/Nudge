// src/components/editor/block-pos.test.ts
import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import { generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import { AttachmentImage } from "./attachment-image";
import { topLevelBlockPos } from "./block-pos";

const exts = [StarterKit, AttachmentImage];
const schema = getSchema(exts);

// <p>a</p> 佔 0..3，<img> 佔 3..4（atom，size 1），<p>b</p> 佔 4..7
const doc = schema.nodeFromJSON(
  generateJSON(
    '<p>a</p><img src="/api/attachments/abc_1" data-attachment-id="abc_1"><p>b</p>',
    exts,
  ),
);

describe("topLevelBlockPos", () => {
  it("doc 結構符合預期（段落、圖片、段落）", () => {
    expect(doc.childCount).toBe(3);
    expect(doc.child(1).type.name).toBe("image");
    expect(doc.child(1).isAtom).toBe(true);
  });

  it("文字 block：pos 在內部 → 取頂層起點", () => {
    expect(topLevelBlockPos(doc, { pos: 1, inside: 0 })).toBe(0);
    expect(topLevelBlockPos(doc, { pos: 5, inside: 4 })).toBe(4);
  });

  it("圖片 block：pos 落在 node 之間（depth 0），靠 inside 找到圖片", () => {
    // 瀏覽器打在圖片上時 pos 可能回 3（圖片前）或 4（圖片後），inside 都是 3
    expect(topLevelBlockPos(doc, { pos: 3, inside: 3 })).toBe(3);
    expect(topLevelBlockPos(doc, { pos: 4, inside: 3 })).toBe(3);
  });

  it("打在空白、沒有 inside → null（呼叫端保留原狀態）", () => {
    expect(topLevelBlockPos(doc, { pos: 3, inside: -1 })).toBeNull();
    expect(topLevelBlockPos(doc, { pos: 7, inside: -1 })).toBeNull();
  });

  it("inside 超出 doc 範圍 → null，不丟例外", () => {
    expect(topLevelBlockPos(doc, { pos: 7, inside: 99 })).toBeNull();
  });
});

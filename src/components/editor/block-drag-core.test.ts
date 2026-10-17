import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import { generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import { EditorState } from "@tiptap/pm/state";
import { AttachmentImage } from "./attachment-image";
import { buildMoveTransaction, nearestSlot } from "./block-drag-core";

const exts = [StarterKit, AttachmentImage];
const schema = getSchema(exts);
function stateOf(html: string) {
  return EditorState.create({ schema, doc: schema.nodeFromJSON(generateJSON(html, exts)) });
}
const texts = (s: EditorState) => s.doc.content.content.map((n) => (n.type.name === "image" ? "[img]" : n.textContent));

describe("buildMoveTransaction", () => {
  // <p>a</p>(0..3) <img>(3..4) <p>b</p>(4..7)
  const html = '<p>a</p><img src="/api/attachments/x1" data-attachment-id="x1"><p>b</p>';
  it("圖片搬到最後", () => {
    const s = stateOf(html);
    const tr = buildMoveTransaction(s, 3, 7)!;
    expect(texts(s.apply(tr))).toEqual(["a", "b", "[img]"]);
  });
  it("最後一段搬到最前", () => {
    const s = stateOf(html);
    const tr = buildMoveTransaction(s, 4, 0)!;
    expect(texts(s.apply(tr))).toEqual(["b", "a", "[img]"]);
  });
  it("搬到自己前後（no-op slot）→ 內容不變", () => {
    const s = stateOf(html);
    expect(texts(s.apply(buildMoveTransaction(s, 3, 3)!))).toEqual(["a", "[img]", "b"]);
    expect(texts(s.apply(buildMoveTransaction(s, 3, 4)!))).toEqual(["a", "[img]", "b"]);
  });
  it("sourcePos 不是頂層 node → null", () => {
    expect(buildMoveTransaction(stateOf(html), 1, 0)).toBeNull();
  });
});

describe("nearestSlot", () => {
  it("取距離最近者，空陣列 → null", () => {
    const slots = [{ pos: 0, y: 0 }, { pos: 4, y: 40 }, { pos: 8, y: 80 }];
    expect(nearestSlot(slots, 55)?.pos).toBe(4);
    expect(nearestSlot(slots, 61)?.pos).toBe(8);
    expect(nearestSlot([], 10)).toBeNull();
  });
});

import type { Node as PMNode } from "@tiptap/pm/model";

/** `EditorView.posAtCoords` 的回傳子集（純邏輯、方便測試）。 */
export interface CoordsHit {
  pos: number;
  /** 命中的 node 起始位置；打在 node 之間（沒有 inside）時為 -1。 */
  inside: number;
}

/**
 * 由 posAtCoords 的結果找出「滑鼠所在的頂層 block」起始位置。
 *
 * - 文字類 block（段落、標題、清單）：`pos` 落在 block 內部，depth ≥ 1，
 *   取 `$pos.before(1)`。
 * - 頂層 atom block（圖片這類沒有內文的 node）：`pos` 落在 block 之間、
 *   depth 為 0，但 `inside` 會指到該 node 的起始位置 → 用 `inside`。
 *   （漏掉這條就是「圖片沒有拖曳把手」的原因。）
 * - 兩者都查不到（打在空白處、`inside` = -1）→ null，呼叫端保留原狀態。
 */
export function topLevelBlockPos(doc: PMNode, hit: CoordsHit): number | null {
  const $pos = doc.resolve(hit.pos);
  if ($pos.depth >= 1) return $pos.before(1);

  if (hit.inside < 0 || hit.inside >= doc.content.size) return null;
  const $inside = doc.resolve(hit.inside);
  return $inside.depth >= 1 ? $inside.before(1) : hit.inside;
}

/**
 * dot-path → camelCase
 * 處理 snake_case 段：例 'task.status.in_progress' → 'taskStatusInProgress'
 */
export function toCamelCase(dotPath) {
  const segments = dotPath.split('.');
  return segments
    .map((seg, i) => {
      const parts = seg.split('_');
      return parts
        .map((p, j) => {
          if (i === 0 && j === 0) return p;
          return p.charAt(0).toUpperCase() + p.slice(1);
        })
        .join('');
    })
    .join('');
}

/**
 * @param canonical {Record<string, string>}  dot-path → value
 * @returns {Record<string, string>}  camelCase → value
 * @throws 若 flatten 後 key 碰撞
 */
export function buildArbKeyMap(canonical) {
  const out = {};
  const sourceOf = {};

  for (const [dotKey, value] of Object.entries(canonical)) {
    const camelKey = toCamelCase(dotKey);
    if (camelKey in out) {
      throw new Error(
        `ARB key collision: "${camelKey}" from both "${sourceOf[camelKey]}" and "${dotKey}"`
      );
    }
    out[camelKey] = value;
    sourceOf[camelKey] = dotKey;
  }

  return out;
}

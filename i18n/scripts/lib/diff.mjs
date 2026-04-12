import { createHash } from 'node:crypto';

/**
 * 把巢狀物件展平成 dot-path → value 的 map
 * 例：{ a: { b: 'x' } } → { 'a.b': 'x' }
 * 葉節點必須是 string，否則丟錯
 */
export function flattenDotPath(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenDotPath(v, key));
    } else if (typeof v === 'string') {
      out[key] = v;
    } else {
      throw new Error(`canonical JSON has non-string leaf at ${key}: ${typeof v}`);
    }
  }
  return out;
}

/** 穩定 SHA256 */
export function hashValue(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * @param prevHashes {Record<string, string>}  上次記錄的 key → hash
 * @param currentValues {Record<string, string>}  現在的 key → raw value
 * @returns {{ added: string[], changed: string[], removed: string[] }}
 */
export function diffCanonical(prevHashes, currentValues) {
  const added = [];
  const changed = [];
  const removed = [];

  for (const [key, value] of Object.entries(currentValues)) {
    const currentHash = hashValue(value);
    if (!(key in prevHashes)) {
      added.push(key);
    } else if (prevHashes[key] !== currentHash) {
      changed.push(key);
    }
  }

  for (const key of Object.keys(prevHashes)) {
    if (!(key in currentValues)) removed.push(key);
  }

  return { added, changed, removed };
}

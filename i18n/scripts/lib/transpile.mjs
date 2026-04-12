/**
 * 抽出 ICU message string 裡的 placeholder 名稱清單（去重）
 * 支援：{name}、{count, plural, ...}、{count, select, ...}
 */
export function extractIcuPlaceholders(str) {
  const names = new Set();
  // 匹配 { 後第一個識別字，直到空白 / , / }
  const re = /\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[,}\s]/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    names.add(m[1]);
  }
  return [...names];
}

/**
 * 是否該 ICU 是 plural / select 格式（決定 placeholder type）
 */
function isPluralOrSelect(str, placeholder) {
  const re = new RegExp(`\\{\\s*${placeholder}\\s*,\\s*(plural|selectordinal)`);
  return re.test(str);
}

/**
 * @param flat {Record<string, string>}  camelCase → value
 * @param localeTag {string}  'zh' | 'en' | 'ja'
 * @returns ARB JSON object
 */
export function buildArbJson(flat, localeTag) {
  const arb = { '@@locale': localeTag };
  for (const [key, value] of Object.entries(flat)) {
    arb[key] = value;
    const placeholders = extractIcuPlaceholders(value);
    const meta = {};
    if (placeholders.length > 0) {
      meta.placeholders = {};
      for (const p of placeholders) {
        meta.placeholders[p] = {
          type: isPluralOrSelect(value, p) ? 'num' : 'Object',
        };
      }
    }
    arb[`@${key}`] = meta;
  }
  return arb;
}

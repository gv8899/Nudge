/**
 * 把 HTML 字串轉為純文字，給卡片預覽顯示用。
 * 不負責 XSS 防護 — 結果只用在 textContent，不會 dangerouslySetInnerHTML。
 *
 * @param html  原始 HTML 字串
 * @param maxLength  截斷長度（含省略號），undefined 表示不截斷
 */
export function stripHtml(html: string, maxLength?: number): string {
  if (!html) return "";
  // 移除 tag
  let text = html.replace(/<[^>]*>/g, " ");
  // decode 常見 entity
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // 壓縮連續空白
  text = text.replace(/\s+/g, " ").trim();
  if (maxLength && text.length > maxLength) {
    return text.slice(0, maxLength).trimEnd() + "…";
  }
  return text;
}

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

/**
 * 卡片「有沒有內容」的唯一判準：去 tag 後有字，或含至少一張已上傳的圖片。
 * 列表過濾（/api/cards）與存檔前 isEmpty（card-detail / task-detail-modal）
 * 都走這裡，兩邊才不會對「純圖卡片」意見不一。
 */
export function hasVisibleContent(html: string | null | undefined): boolean {
  if (!html) return false;
  if (stripHtml(html).length > 0) return true;
  // <img ...> 但排除上傳中 placeholder（無 src、帶 data-upload-pending）
  const imgTags = html.match(/<img\b[^>]*>/g) ?? [];
  return imgTags.some((tag) => !/data-upload-pending=/.test(tag));
}

/**
 * 存檔前要不要把內文當空白存成 ""。
 * 與 hasVisibleContent 的差別：**上傳中的 placeholder 也要保留**。否則「新卡片
 * 只貼一張圖、上傳完成前就關掉」會存成 ""，背景補寫（use-image-upload 的
 * server-side recovery）就找不到 placeholder 可以換，圖片無聲消失。
 * 列表過濾（/api/cards）仍用 hasVisibleContent，純 placeholder 卡片不會出現在列表，
 * 等補寫把正式 <img> 寫進去才會出現。
 */
export function shouldPersistDescription(html: string | null | undefined): boolean {
  if (!html) return false;
  return hasVisibleContent(html) || /<img\b[^>]*data-upload-pending=/.test(html);
}

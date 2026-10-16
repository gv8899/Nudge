//
// 純字串工具，Web 與 Apple bundle（經 @web-editor alias）共用。不得 import React。
//
// 內文 HTML 永遠存 `/api/attachments/<id>`（server form）。Apple 的 WKWebView
// <img> 不會帶 Bearer，所以 load() 前改成 `nudge-attachment://attachment/<id>`
// 交給 AttachmentSchemeHandler 代抓；getHTML() / change 前改回來，保證三邊
// HTML byte-identical。

export const ATTACHMENT_API_PREFIX = "/api/attachments/";
export const ATTACHMENT_SCHEME_PREFIX = "nudge-attachment://attachment/";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function attachmentApiUrl(id: string): string {
  return `${ATTACHMENT_API_PREFIX}${id}`;
}

export function isAllowedImageSrc(src: string | null | undefined): boolean {
  if (!src) return false;
  for (const prefix of [ATTACHMENT_API_PREFIX, ATTACHMENT_SCHEME_PREFIX]) {
    if (src.startsWith(prefix)) return ID_RE.test(src.slice(prefix.length));
  }
  return false;
}

const SRC_API_RE = /src="\/api\/attachments\/([A-Za-z0-9_-]{1,64})"/g;
const SRC_SCHEME_RE = /src="nudge-attachment:\/\/attachment\/([A-Za-z0-9_-]{1,64})"/g;

export function toNativeAttachmentURLs(html: string): string {
  return html.replace(SRC_API_RE, `src="${ATTACHMENT_SCHEME_PREFIX}$1"`);
}

export function toServerAttachmentURLs(html: string): string {
  return html.replace(SRC_SCHEME_RE, `src="${ATTACHMENT_API_PREFIX}$1"`);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 卡片在上傳途中被關掉時，DB 裡存的是 placeholder
 * `<img data-upload-pending="true" data-upload-id="<uploadId>" alt="">`。
 * 上傳完成後把它整個換成最終 tag（屬性順序同 AttachmentImage 序列化：
 * src, alt, data-attachment-id, width, height；null 的寬高省略）。
 * placeholder 已不在（被後續存檔丟掉）或 id 不合法 → null。
 */
export function replacePendingImage(
  html: string,
  uploadId: string,
  result: { id: string; width: number | null; height: number | null },
): string | null {
  if (!ID_RE.test(result.id)) return null;
  const re = new RegExp(`<img\\b[^>]*\\bdata-upload-id="${escapeRegExp(uploadId)}"[^>]*>`);
  if (!re.test(html)) return null;
  let tag = `<img src="${attachmentApiUrl(result.id)}" alt="" data-attachment-id="${result.id}"`;
  if (result.width != null) tag += ` width="${result.width}"`;
  if (result.height != null) tag += ` height="${result.height}"`;
  tag += ">";
  return html.replace(re, () => tag);
}

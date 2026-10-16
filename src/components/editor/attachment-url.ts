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

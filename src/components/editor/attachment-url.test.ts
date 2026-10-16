import { describe, it, expect } from "vitest";
import {
  attachmentApiUrl,
  isAllowedImageSrc,
  toNativeAttachmentURLs,
  toServerAttachmentURLs,
} from "./attachment-url";

describe("attachment-url", () => {
  it("attachmentApiUrl", () => {
    expect(attachmentApiUrl("abc_-9")).toBe("/api/attachments/abc_-9");
  });

  it("isAllowedImageSrc 接受 API 與 scheme 兩種、拒絕其他", () => {
    expect(isAllowedImageSrc("/api/attachments/V1StGXR8_Z5jdHi6B-myT")).toBe(true);
    expect(isAllowedImageSrc("nudge-attachment://attachment/V1StGXR8_Z5jdHi6B-myT")).toBe(true);
    expect(isAllowedImageSrc("https://evil.example/x.png")).toBe(false);
    expect(isAllowedImageSrc("blob:http://localhost/123")).toBe(false);
    expect(isAllowedImageSrc("data:image/png;base64,AAAA")).toBe(false);
    expect(isAllowedImageSrc("/api/attachments/")).toBe(false);
    expect(isAllowedImageSrc("/api/attachments/../users")).toBe(false);
    expect(isAllowedImageSrc(null)).toBe(false);
    expect(isAllowedImageSrc(undefined)).toBe(false);
  });

  const serverHtml =
    '<p>hi</p><img src="/api/attachments/abc123" data-attachment-id="abc123" width="10" height="20"><p>x</p>';
  const nativeHtml =
    '<p>hi</p><img src="nudge-attachment://attachment/abc123" data-attachment-id="abc123" width="10" height="20"><p>x</p>';

  it("toNativeAttachmentURLs / toServerAttachmentURLs 互為反函式", () => {
    expect(toNativeAttachmentURLs(serverHtml)).toBe(nativeHtml);
    expect(toServerAttachmentURLs(nativeHtml)).toBe(serverHtml);
    expect(toServerAttachmentURLs(toNativeAttachmentURLs(serverHtml))).toBe(serverHtml);
  });

  it("不碰 href 或其他屬性裡的同字串", () => {
    const html = '<a href="/api/attachments/abc123">link</a>';
    expect(toNativeAttachmentURLs(html)).toBe(html);
  });

  it("多張圖都改", () => {
    const html = '<img src="/api/attachments/a1"><img src="/api/attachments/b2">';
    expect(toNativeAttachmentURLs(html)).toBe(
      '<img src="nudge-attachment://attachment/a1"><img src="nudge-attachment://attachment/b2">',
    );
  });
});

import { describe, it, expect } from "vitest";
import {
  attachmentApiUrl,
  isAllowedImageSrc,
  replacePendingImage,
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

describe("replacePendingImage", () => {
  const placeholder = '<img data-upload-pending="true" data-upload-id="u_1-a" alt="">';

  it("找到 placeholder → 換成最終 tag（屬性順序同 node 序列化）", () => {
    const html = `<p>a</p>${placeholder}<p>b</p>`;
    expect(replacePendingImage(html, "u_1-a", { id: "att_9", width: 800, height: 600 })).toBe(
      '<p>a</p><img src="/api/attachments/att_9" alt="" data-attachment-id="att_9" width="800" height="600"><p>b</p>',
    );
  });

  it("width / height 為 null → 省略該屬性", () => {
    expect(replacePendingImage(placeholder, "u_1-a", { id: "att_9", width: null, height: null })).toBe(
      '<img src="/api/attachments/att_9" alt="" data-attachment-id="att_9">',
    );
  });

  it("placeholder 不在（已被別次存檔丟掉）→ null", () => {
    expect(replacePendingImage("<p>a</p>", "u_1-a", { id: "att_9", width: 1, height: 1 })).toBeNull();
  });

  it("只換對應 upload-id，不碰其他 placeholder", () => {
    const other = '<img data-upload-pending="true" data-upload-id="u2" alt="">';
    expect(replacePendingImage(other + placeholder, "u_1-a", { id: "x1", width: null, height: null })).toBe(
      other + '<img src="/api/attachments/x1" alt="" data-attachment-id="x1">',
    );
    // upload-id 是另一個 id 的前綴也不能誤中
    expect(replacePendingImage(placeholder, "u_1", { id: "x1", width: null, height: null })).toBeNull();
  });

  it("不合法的附件 id → null（不把奇怪字串寫進內文）", () => {
    expect(replacePendingImage(placeholder, "u_1-a", { id: '"><script>', width: null, height: null })).toBeNull();
  });
});

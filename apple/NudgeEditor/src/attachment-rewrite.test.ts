import { describe, it, expect } from "vitest";
import { toNativeAttachmentURLs, toServerAttachmentURLs } from "@web-editor/attachment-url";
import { AttachmentImage } from "@web-editor/attachment-image";

describe("attachment rewrite via @web-editor alias", () => {
  it("雙向改寫", () => {
    const server = '<img src="/api/attachments/abc" data-attachment-id="abc">';
    const native = toNativeAttachmentURLs(server);
    expect(native).toContain('src="nudge-attachment://attachment/abc"');
    expect(toServerAttachmentURLs(native)).toBe(server);
  });
  it("AttachmentImage 可載入且 name 是 image", () => {
    expect(AttachmentImage.name).toBe("image");
  });
});

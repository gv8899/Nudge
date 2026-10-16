// src/components/editor/attachment-image.test.ts
import { describe, it, expect } from "vitest";
import { generateHTML, generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import { AttachmentImage } from "./attachment-image";

const exts = [StarterKit, AttachmentImage];
const roundtrip = (html: string) => generateHTML(generateJSON(html, exts), exts);

describe("AttachmentImage parse / render", () => {
  it("保留附件圖片與屬性", () => {
    const html =
      '<p>a</p><img src="/api/attachments/abc_1" data-attachment-id="abc_1" width="800" height="600" alt=""><p>b</p>';
    expect(roundtrip(html)).toBe(
      '<p>a</p><img src="/api/attachments/abc_1" alt="" data-attachment-id="abc_1" width="800" height="600"><p>b</p>',
    );
  });

  it("drops external img on parse", () => {
    const html = '<p>a</p><img src="https://evil.example/x.png"><p>b</p>';
    expect(roundtrip(html)).toBe("<p>a</p><p>b</p>");
  });

  it("也接受 nudge-attachment scheme（Apple 端 load 後的形態）", () => {
    const html =
      '<img src="nudge-attachment://attachment/abc_1" data-attachment-id="abc_1" alt="">';
    expect(roundtrip(html)).toBe(
      '<img src="nudge-attachment://attachment/abc_1" alt="" data-attachment-id="abc_1">',
    );
  });

  it("renders pending upload without src", () => {
    const json = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "blob:http://x/1", uploadId: "u1", attachmentId: null, width: null, height: null, alt: "" } },
      ],
    };
    const html = generateHTML(json, exts);
    expect(html).toBe('<img data-upload-pending="true" alt="">');
    // 再 parse 回來會被丟掉（沒有合法 src）
    expect(roundtrip(html)).toBe("<p></p>");
  });

  it("不解析 data: / blob: src", () => {
    expect(roundtrip('<img src="data:image/png;base64,AAAA">')).toBe("<p></p>");
    expect(roundtrip('<img src="blob:http://localhost/1">')).toBe("<p></p>");
  });
});

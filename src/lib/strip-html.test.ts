import { describe, it, expect } from "vitest";
import { stripHtml, hasVisibleContent } from "./strip-html";

describe("stripHtml", () => {
  it("去 tag、decode entity、壓空白", () => {
    expect(stripHtml("<p>a&nbsp;&amp;</p><p>b</p>")).toBe("a & b");
  });
});

describe("hasVisibleContent", () => {
  it("空 / 只有空段落 → false", () => {
    expect(hasVisibleContent("")).toBe(false);
    expect(hasVisibleContent(null)).toBe(false);
    expect(hasVisibleContent("<p></p>")).toBe(false);
    expect(hasVisibleContent("<p>  </p><p></p>")).toBe(false);
  });
  it("有字 → true", () => {
    expect(hasVisibleContent("<p>hi</p>")).toBe(true);
  });
  it("只有圖片、沒有字 → true", () => {
    expect(hasVisibleContent('<img src="/api/attachments/abc" data-attachment-id="abc">')).toBe(true);
  });
  it("只有上傳中的 placeholder → false", () => {
    expect(hasVisibleContent('<img data-upload-pending="true">')).toBe(false);
  });
});

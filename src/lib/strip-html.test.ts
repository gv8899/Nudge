import { describe, it, expect } from "vitest";
import { stripHtml, hasVisibleContent, shouldPersistDescription } from "./strip-html";

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

describe("shouldPersistDescription", () => {
  it("空 / 只有空段落 → false（存成 \"\"）", () => {
    expect(shouldPersistDescription("")).toBe(false);
    expect(shouldPersistDescription(null)).toBe(false);
    expect(shouldPersistDescription("<p></p>")).toBe(false);
  });
  it("有字或正式圖片 → true", () => {
    expect(shouldPersistDescription("<p>hi</p>")).toBe(true);
    expect(shouldPersistDescription('<img src="/api/attachments/abc" data-attachment-id="abc">')).toBe(true);
  });
  it("只有上傳中的 placeholder → true（保留給背景補寫）", () => {
    expect(shouldPersistDescription('<p></p><img data-upload-pending="true" data-upload-id="u1" alt="">')).toBe(true);
    // 列表過濾仍視為空白
    expect(hasVisibleContent('<p></p><img data-upload-pending="true" data-upload-id="u1" alt="">')).toBe(false);
  });
});

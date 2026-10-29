import { describe, it, expect } from "vitest";
import { markdownToHtml } from "./markdown";

describe("markdownToHtml", () => {
  it("renders headings, emphasis, lists", () => {
    const html = markdownToHtml("# 京都\n\n**第一天**\n\n- 清水寺\n- 二年坂");
    expect(html).toContain("<h1>京都</h1>");
    expect(html).toContain("<strong>第一天</strong>");
    expect(html).toContain("<li>清水寺</li>");
  });

  it("renders task lists in tiptap format", () => {
    const html = markdownToHtml("- [ ] 訂車票\n- [x] 訂飯店");
    expect(html).toContain('<ul data-type="taskList">');
    expect(html).toContain('<li data-type="taskItem" data-checked="false"><p>訂車票</p></li>');
    expect(html).toContain('data-checked="true"><p>訂飯店</p>');
    expect(html).not.toContain("<input");
  });

  it("mixed lists keep items and turn checkboxes into symbols", () => {
    const html = markdownToHtml("- 清水寺\n- [ ] 訂車票\n- [x] 訂飯店");
    expect(html).not.toContain("<input");
    expect(html).toContain("<li>☐ 訂車票</li>");
    expect(html).toContain("<li>☑ 訂飯店</li>");
  });

  it("escapes raw html", () => {
    const html = markdownToHtml('hi <script>alert(1)</script> <img src=x onerror="y">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops non-http links but keeps text", () => {
    expect(markdownToHtml("[x](javascript:alert(1))")).toBe("<p>x</p>");
    expect(markdownToHtml("[site](https://a.com)")).toBe('<p><a href="https://a.com">site</a></p>');
  });

  it("turns external images into links and keeps nudge attachments", () => {
    expect(markdownToHtml("![pic](https://a.com/p.jpg)")).toBe(
      '<p><a href="https://a.com/p.jpg">pic</a></p>',
    );
    expect(markdownToHtml("![](/api/attachments/abc_1)")).toContain('data-attachment-id="abc_1"');
  });

  it("flattens tables into list rows", () => {
    const html = markdownToHtml("| 時間 | 地點 |\n|---|---|\n| 9:00 | 清水寺 |");
    expect(html).toBe("<ul><li><p>時間 | 地點</p></li><li><p>9:00 | 清水寺</p></li></ul>");
  });
});

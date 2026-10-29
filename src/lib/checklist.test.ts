import { describe, it, expect } from "vitest";
import cases from "./checklist-cases.json";
import {
  parseChecklist,
  applyChecklistEdit,
  checklistTransition,
  type ChecklistEdit,
} from "./checklist";

// Fixture `checklist-cases.json` 由 TS 與 Swift（ChecklistHTMLTests）共吃。

describe("parseChecklist", () => {
  it.each(cases.parse)("$name", (c) => {
    expect(parseChecklist(c.html)).toEqual(c.items);
  });
});

describe("applyChecklistEdit", () => {
  it.each(cases.edit)("$name", (c) => {
    expect(applyChecklistEdit(c.html, c.edit as ChecklistEdit)).toBe(c.expected);
  });
});

describe("checklistTransition", () => {
  it.each(cases.transition)("$name", (c) => {
    expect(checklistTransition(c.before, c.after)).toBe(c.expected);
  });
});

// remove 還沒鏡像到 Swift，所以先放 TS-only（不進共用 fixture）。做 Apple 端時
// 再把這些搬進 checklist-cases.json。
describe("applyChecklistEdit · remove", () => {
  const li = (text: string, checked: boolean) =>
    `<li data-checked="${checked}" data-type="taskItem"><label><input type="checkbox"${
      checked ? ' checked="checked"' : ""
    }><span></span></label><div><p>${text}</p></div></li>`;
  const ul = (...items: string[]) => `<ul data-type="taskList">${items.join("")}</ul>`;

  it("刪中間一項，其餘保留", () => {
    const html = ul(li("A", false), li("B", true), li("C", false));
    const out = applyChecklistEdit(html, { kind: "remove", index: 1, text: "B" });
    expect(out).toBe(ul(li("A", false), li("C", false)));
  });

  it("刪最後一項 → 清掉空的 taskList ul", () => {
    const html = `<p>內文</p>${ul(li("只有這項", false))}`;
    const out = applyChecklistEdit(html, { kind: "remove", index: 0, text: "只有這項" });
    expect(out).toBe("<p>內文</p>");
  });

  it("文字對不上（內容已被改）→ 回 null 放棄", () => {
    const html = ul(li("A", false), li("B", false));
    const out = applyChecklistEdit(html, { kind: "remove", index: 0, text: "舊文字" });
    expect(out).toBeNull();
  });

  it("index 越界 → 回 null", () => {
    const html = ul(li("A", false));
    expect(applyChecklistEdit(html, { kind: "remove", index: 5, text: "A" })).toBeNull();
  });
});

// setText 也還沒鏡像到 Swift，先 TS-only。
describe("applyChecklistEdit · setText", () => {
  const li = (text: string, checked: boolean) =>
    `<li data-checked="${checked}" data-type="taskItem"><label><input type="checkbox"${
      checked ? ' checked="checked"' : ""
    }><span></span></label><div><p>${text}</p></div></li>`;
  const ul = (...items: string[]) => `<ul data-type="taskList">${items.join("")}</ul>`;

  it("改文字、保留勾選狀態與結構", () => {
    const html = ul(li("舊", true), li("B", false));
    const out = applyChecklistEdit(html, {
      kind: "setText",
      index: 0,
      text: "舊",
      newText: "新",
    });
    expect(out).toBe(ul(li("新", true), li("B", false)));
  });

  it("特殊字元會被 escape", () => {
    const html = ul(li("A", false));
    const out = applyChecklistEdit(html, {
      kind: "setText",
      index: 0,
      text: "A",
      newText: '<b>&"',
    });
    expect(out).toContain("&lt;b&gt;&amp;&quot;");
    expect(out).not.toContain("<b>");
  });

  it("文字沒變 → 回原字串", () => {
    const html = ul(li("A", false));
    expect(
      applyChecklistEdit(html, { kind: "setText", index: 0, text: "A", newText: "A" })
    ).toBe(html);
  });

  it("空新字串 / 位置對不上 → 回 null", () => {
    const html = ul(li("A", false));
    expect(
      applyChecklistEdit(html, { kind: "setText", index: 0, text: "A", newText: "  " })
    ).toBeNull();
    expect(
      applyChecklistEdit(html, { kind: "setText", index: 0, text: "舊", newText: "新" })
    ).toBeNull();
  });
});

// move 也還沒鏡像到 Swift，先 TS-only。
describe("applyChecklistEdit · move", () => {
  const li = (text: string, checked: boolean) =>
    `<li data-checked="${checked}" data-type="taskItem"><label><input type="checkbox"${
      checked ? ' checked="checked"' : ""
    }><span></span></label><div><p>${text}</p></div></li>`;
  const ul = (...items: string[]) => `<ul data-type="taskList">${items.join("")}</ul>`;

  it("往下搬：第 0 項移到第 2 位", () => {
    const html = ul(li("A", false), li("B", true), li("C", false));
    const out = applyChecklistEdit(html, { kind: "move", from: 0, to: 2, text: "A" });
    expect(out).toBe(ul(li("B", true), li("C", false), li("A", false)));
  });

  it("往上搬：第 2 項移到第 0 位、保留勾選", () => {
    const html = ul(li("A", false), li("B", false), li("C", true));
    const out = applyChecklistEdit(html, { kind: "move", from: 2, to: 0, text: "C" });
    expect(out).toBe(ul(li("C", true), li("A", false), li("B", false)));
  });

  it("保留 li 以外的周邊內容", () => {
    const html = `<p>內文</p>${ul(li("A", false), li("B", false))}<p>尾</p>`;
    const out = applyChecklistEdit(html, { kind: "move", from: 1, to: 0, text: "B" });
    expect(out).toBe(`<p>內文</p>${ul(li("B", false), li("A", false))}<p>尾</p>`);
  });

  it("li 之間有換行/縮排也能搬（真實 HTML 常見）", () => {
    const html = `<ul data-type="taskList">\n  ${li("A", false)}\n  ${li("B", false)}\n</ul>`;
    const out = applyChecklistEdit(html, { kind: "move", from: 0, to: 1, text: "A" });
    // li 之間的空白會被收掉，清單前後（第一個 li 之前、最後一個 li 之後）保留。
    expect(out).toBe(
      `<ul data-type="taskList">\n  ${li("B", false)}${li("A", false)}\n</ul>`
    );
  });

  it("from===to → 回原字串；位置對不上 / 越界 → 回 null", () => {
    const html = ul(li("A", false), li("B", false));
    expect(applyChecklistEdit(html, { kind: "move", from: 0, to: 0, text: "A" })).toBe(html);
    expect(applyChecklistEdit(html, { kind: "move", from: 0, to: 1, text: "舊" })).toBeNull();
    expect(applyChecklistEdit(html, { kind: "move", from: 0, to: 9, text: "A" })).toBeNull();
  });
});

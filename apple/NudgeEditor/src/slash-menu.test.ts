// apple/NudgeEditor/src/slash-menu.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mountSlashMenu } from "./slash-menu";
import type { SlashCommandItem } from "@web-editor/slash-command-defs";

const items = [
  { id: "text", label: "Text", description: "d", keywords: [], command: () => {} },
  { id: "h1", label: "H1", description: "d", keywords: [], command: () => {} },
] as unknown as SlashCommandItem[];

function setScroll(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
}

afterEach(() => {
  document.body.innerHTML = "";
  setScroll(0);
});

describe("mountSlashMenu positioning", () => {
  it("文件座標 = viewport 座標 + scrollY（macOS 內部捲動的 WKWebView）", () => {
    setScroll(1373);
    const rect = { top: 510, bottom: 528, left: 40, right: 60, width: 20, height: 18 } as DOMRect;
    const handle = mountSlashMenu({ items, command: () => {}, clientRect: () => rect }, {});
    const el = document.querySelector<HTMLElement>(".nudge-slash-menu")!;
    expect(el).toBeTruthy();
    expect(el.children.length).toBe(2);
    // jsdom 沒有 layout：offsetHeight = 0 → menuHeight 退回 200；innerHeight 預設 768 → roomBelow 240 ≥ 208 → 放下方
    expect(el.style.top).toBe(`${528 + 4 + 1373}px`);
    expect(el.style.left).toBe("40px");
    handle.destroy();
  });

  it("沒有捲動時與原本一致", () => {
    const rect = { top: 100, bottom: 118, left: 16, right: 30, width: 14, height: 18 } as DOMRect;
    const handle = mountSlashMenu({ items, command: () => {}, clientRect: () => rect }, {});
    const el = document.querySelector<HTMLElement>(".nudge-slash-menu")!;
    expect(el.style.top).toBe("122px");
    handle.destroy();
    expect(document.querySelector(".nudge-slash-menu")).toBeNull();
  });
});

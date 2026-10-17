// apple/NudgeEditor/src/block-drag.test.ts
//
// jsdom 沒有 layout：getBoundingClientRect 全回 0、posAtCoords 會丟錯。
// 這裡 stub `editor.view.posAtCoords` 與兩個 <p> 的 getBoundingClientRect，
// 讓共用 core 的 hoveredBlockAt / computeDropSlots 拿到可預測的座標。
import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { AttachmentImage } from "@web-editor/attachment-image";
import { mountBlockDrag } from "./block-drag";

function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, left: 0, right: 100, width: 100, height, x: 0, y: top, toJSON() {} } as DOMRect;
}

/** jsdom 沒有 DragEvent / DataTransfer：自己組事件 + 假 dataTransfer。 */
function fakeDataTransfer(types: string[] = []) {
  const data: Record<string, string> = {};
  return {
    types: [...types],
    effectAllowed: "none",
    dropEffect: "none",
    setData(type: string, v: string) {
      data[type] = v;
      if (!this.types.includes(type)) this.types.push(type);
    },
    getData(type: string) {
      return data[type] ?? "";
    },
    setDragImage() {},
    files: [] as File[],
    items: [] as unknown[],
  };
}

function dragEvent(type: string, init: { clientX?: number; clientY?: number; dataTransfer?: unknown }) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "clientX", { value: init.clientX ?? 0 });
  Object.defineProperty(e, "clientY", { value: init.clientY ?? 0 });
  Object.defineProperty(e, "dataTransfer", { value: init.dataTransfer ?? null });
  return e as DragEvent;
}

let cleanupFns: Array<() => void> = [];
afterEach(() => {
  cleanupFns.forEach((f) => f());
  cleanupFns = [];
});

function setup() {
  const container = document.createElement("div");
  container.id = "editor";
  document.body.appendChild(container);
  const editor = new Editor({
    element: container,
    extensions: [StarterKit, AttachmentImage],
    content: "<p>a</p><p>b</p>",
  });
  const ps = editor.view.dom.querySelectorAll("p");
  // p "a" 在 y 0–20，p "b" 在 y 30–50（container rect 全 0 → 相對座標＝絕對座標）
  (ps[0] as HTMLElement).getBoundingClientRect = () => rect(0, 20);
  (ps[1] as HTMLElement).getBoundingClientRect = () => rect(30, 20);
  // 文件：<p>a</p> 在 pos 0（內文 pos 1），<p>b</p> 在 pos 3（內文 pos 4）
  editor.view.posAtCoords = ({ top }: { left: number; top: number }) =>
    top < 25 ? { pos: 1, inside: 0 } : { pos: 4, inside: 3 };
  const drag = mountBlockDrag(editor, container);
  const handle = container.querySelector(".nudge-drag-handle") as HTMLButtonElement;
  const indicator = container.querySelector(".nudge-drop-indicator") as HTMLDivElement;
  cleanupFns.push(() => {
    drag.destroy();
    editor.destroy();
    container.remove();
  });
  return { editor, container, drag, handle, indicator, ps };
}

function hover(_container: HTMLElement, target: Element, clientY: number) {
  const e = new MouseEvent("mousemove", { bubbles: true, clientX: 10, clientY });
  target.dispatchEvent(e);
}

describe("mountBlockDrag", () => {
  it("掛上把手與指示線，初始隱藏；container 加 class", () => {
    const { container, handle, indicator } = setup();
    expect(container.classList.contains("nudge-has-drag")).toBe(true);
    expect(handle).toBeTruthy();
    expect(handle.draggable).toBe(true);
    expect(indicator).toBeTruthy();
    expect(handle.style.display).toBe("none");
    expect(indicator.style.display).toBe("none");
  });

  it("mousemove 到 block → 顯示把手並對齊 block 中線；mouseleave 隱藏", () => {
    const { container, handle, ps } = setup();
    hover(container, ps[1], 40);
    expect(handle.style.display).toBe("flex");
    expect(handle.style.top).toBe(`${30 + 10 - 12}px`);
    container.dispatchEvent(new MouseEvent("mouseleave"));
    expect(handle.style.display).toBe("none");
  });

  it("mousemove 到把手本身 → 保留目前狀態", () => {
    const { container, handle, ps } = setup();
    hover(container, ps[0], 10);
    const top = handle.style.top;
    hover(container, handle, 45); // 若沒忽略，會跳到 p "b"
    expect(handle.style.display).toBe("flex");
    expect(handle.style.top).toBe(top);
  });

  it("dragstart → 只帶自訂 MIME（無 Files、無 text/plain）並立刻顯示指示線；drop → 搬移 block 並清狀態", () => {
    const { editor, container, handle, indicator, ps } = setup();
    hover(container, ps[0], 10); // hovered = <p>a</p>
    const dt = fakeDataTransfer();
    handle.dispatchEvent(dragEvent("dragstart", { clientY: 10, dataTransfer: dt }));
    expect(dt.types).toEqual(["application/x-nudge-block"]);
    expect(dt.getData("application/x-nudge-block")).toBe("");
    expect(dt.getData("text/plain")).toBe("");
    expect(dt.effectAllowed).toBe("move");
    // slots: 0 → y0, 3 → y25（20 與 30 中點）, 6 → y50；cursor 10 → slot y0
    expect(indicator.style.display).toBe("block");
    expect(indicator.style.top).toBe("-1px");

    const over = dragEvent("dragover", { clientY: 48, dataTransfer: dt });
    ps[1].dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    expect(indicator.style.top).toBe("49px");

    // drop 打在 ProseMirror 內：capture phase 先 preventDefault，PM 不得把
    // 任何東西插入文件。
    const drop = dragEvent("drop", { clientY: 48, dataTransfer: dt });
    ps[1].dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(editor.getHTML()).toBe("<p>b</p><p>a</p>");
    expect(indicator.style.display).toBe("none");
    expect(handle.style.display).toBe("none");
  });

  it("dragend（取消）→ 清指示線與拖曳狀態，之後的 dragover 不再被攔", () => {
    const { editor, container, handle, indicator, ps } = setup();
    hover(container, ps[0], 10);
    const dt = fakeDataTransfer();
    handle.dispatchEvent(dragEvent("dragstart", { clientY: 10, dataTransfer: dt }));
    handle.dispatchEvent(dragEvent("dragend", { dataTransfer: dt }));
    expect(indicator.style.display).toBe("none");
    // 打在 container（ProseMirror 外）：避免 PM dropcursor 的 timer 在 destroy 後觸發
    const over = dragEvent("dragover", { clientY: 48, dataTransfer: dt });
    container.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(false);
    expect(editor.getHTML()).toBe("<p>a</p><p>b</p>");
  });

  it("沒有 hovered 時 dragstart 為 no-op", () => {
    const { handle, indicator } = setup();
    const dt = fakeDataTransfer();
    handle.dispatchEvent(dragEvent("dragstart", { clientY: 10, dataTransfer: dt }));
    expect(dt.types).toEqual([]);
    expect(indicator.style.display).toBe("none");
  });

  it("外部檔案拖入（Files）→ 把手的 dragover / drop 不處理、不 preventDefault", () => {
    const { editor, container, indicator } = setup();
    const dt = fakeDataTransfer(["Files"]);
    const over = dragEvent("dragover", { clientY: 10, dataTransfer: dt });
    container.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(false);
    const drop = dragEvent("drop", { clientY: 10, dataTransfer: dt });
    container.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(false);
    expect(indicator.style.display).toBe("none");
    expect(editor.getHTML()).toBe("<p>a</p><p>b</p>");
  });

  it("destroy → 移除元素、class 與 listener", () => {
    const { container, drag, handle, indicator, ps } = setup();
    drag.destroy();
    expect(container.querySelector(".nudge-drag-handle")).toBeNull();
    expect(container.querySelector(".nudge-drop-indicator")).toBeNull();
    expect(container.classList.contains("nudge-has-drag")).toBe(false);
    hover(container, ps[0], 10);
    expect(handle.style.display).toBe("none");
    expect(indicator.isConnected).toBe(false);
  });
});

// apple/NudgeEditor/src/slash-menu.ts
import type { SlashCommandItem } from "@web-editor/slash-command-defs";

export interface SlashMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  clientRect: (() => DOMRect | null) | null;
}

export interface SlashMenuHandle {
  update(props: SlashMenuProps): void;
  destroy(): void;
  onKeyDown(event: KeyboardEvent): boolean;
}

export function mountSlashMenu(props: SlashMenuProps, labels: Record<string, { label: string; description: string }>): SlashMenuHandle {
  let selectedIndex = 0;
  let current = props;

  const container = document.createElement("div");
  container.className = "nudge-slash-menu";
  document.body.appendChild(container);

  // 鍵盤導航時抑制 hover 高亮（避免 is-active + hover 同時亮兩格）；
  // 滑鼠一動就恢復 hover。
  container.addEventListener("mousemove", () => {
    container.classList.remove("nudge-kbd-nav");
  });

  function render() {
    container.innerHTML = "";
    let activeEl: HTMLElement | null = null;
    current.items.forEach((item, idx) => {
      const itemEl = document.createElement("div");
      itemEl.className = "nudge-slash-menu-item" + (idx === selectedIndex ? " is-active" : "");
      if (idx === selectedIndex) activeEl = itemEl;
      const labelInfo = labels[item.id] ?? { label: item.label, description: item.description };

      const labelEl = document.createElement("div");
      labelEl.className = "nudge-slash-menu-item-label";
      labelEl.textContent = labelInfo.label;
      itemEl.appendChild(labelEl);

      const descEl = document.createElement("div");
      descEl.className = "nudge-slash-menu-item-desc";
      descEl.textContent = labelInfo.description;
      itemEl.appendChild(descEl);

      itemEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        current.command(item);
      });
      itemEl.addEventListener("touchstart", (e) => {
        e.preventDefault();
        current.command(item);
      });
      container.appendChild(itemEl);
    });
    positionMenu();
    // 方向鍵移動選中項時，把它捲進選單可視範圍（選單 max-height:40vh +
    // overflow-y:auto，超過 9 項往下選會走出可視區）。只捲選單容器自己、
    // 不呼叫 scrollIntoView 以免連帶捲動編輯器頁面。
    if (activeEl) {
      const el = activeEl as HTMLElement;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;
      const elTop = el.offsetTop;
      const elBottom = elTop + el.offsetHeight;
      if (elTop < viewTop) {
        container.scrollTop = elTop;
      } else if (elBottom > viewBottom) {
        container.scrollTop = elBottom - container.clientHeight;
      }
    }
  }

  function positionMenu() {
    const rect = current.clientRect?.();
    if (!rect) return;
    const menuHeight = container.offsetHeight || 200;
    const vp = window.visualViewport;
    const viewportBottom = vp ? vp.offsetTop + vp.height : window.innerHeight;
    const roomBelow = viewportBottom - rect.bottom;
    const placeAbove = roomBelow < menuHeight + 8;
    const top = placeAbove ? rect.top - menuHeight - 4 : rect.bottom + 4;
    container.style.top = `${Math.max(8, top)}px`;
    container.style.left = `${rect.left}px`;
  }

  render();

  return {
    update(props: SlashMenuProps) {
      current = props;
      if (selectedIndex >= current.items.length) selectedIndex = 0;
      render();
    },
    destroy() {
      container.remove();
    },
    onKeyDown(event: KeyboardEvent): boolean {
      if (event.key === "ArrowDown") {
        container.classList.add("nudge-kbd-nav");
        selectedIndex = (selectedIndex + 1) % current.items.length;
        render();
        return true;
      }
      if (event.key === "ArrowUp") {
        container.classList.add("nudge-kbd-nav");
        selectedIndex = (selectedIndex - 1 + current.items.length) % current.items.length;
        render();
        return true;
      }
      if (event.key === "Enter") {
        const item = current.items[selectedIndex];
        if (item) {
          current.command(item);
          return true;
        }
      }
      if (event.key === "Escape") {
        return true;
      }
      return false;
    },
  };
}

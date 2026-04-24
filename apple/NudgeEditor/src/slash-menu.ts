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

  function render() {
    container.innerHTML = "";
    current.items.forEach((item, idx) => {
      const itemEl = document.createElement("div");
      itemEl.className = "nudge-slash-menu-item" + (idx === selectedIndex ? " is-active" : "");
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
        selectedIndex = (selectedIndex + 1) % current.items.length;
        render();
        return true;
      }
      if (event.key === "ArrowUp") {
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

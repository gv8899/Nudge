import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from "react";
import type { Editor, Range } from "@tiptap/core";
import type { SlashCommandItem } from "./slash-command-items";

interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  editor: Editor;
  range: Range;
}

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandMenu = forwardRef<
  SlashCommandMenuRef,
  SlashCommandMenuProps
>(function SlashCommandMenu({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) command(item);
    },
    [items, command]
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-lg bg-popover text-popover-foreground border border-border shadow-lg p-3 text-sm text-text-dim">
        沒有符合的項目
      </div>
    );
  }

  return (
    <div
      role="menu"
      className="w-72 rounded-lg bg-popover text-popover-foreground border border-border shadow-lg p-1.5 flex flex-col gap-0.5"
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        const isSelected = index === selectedIndex;
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`flex items-center gap-3 px-3 py-2 rounded text-left transition-colors ${
              isSelected
                ? "bg-muted text-foreground"
                : "text-foreground/90 hover:bg-muted/60"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 text-text-dim" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{item.label}</div>
              <div className="text-xs text-text-dim truncate">
                {item.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});

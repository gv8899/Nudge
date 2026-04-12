import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Minus,
  type LucideIcon,
} from "lucide-react";
import type { Editor, Range } from "@tiptap/core";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  requiredExtension?: string;
  command: (args: { editor: Editor; range: Range }) => void;
}

interface SlashCommandDef {
  id: string;
  icon: LucideIcon;
  requiredExtension?: string;
  command: (args: { editor: Editor; range: Range }) => void;
}

const SLASH_COMMAND_DEFS: SlashCommandDef[] = [
  {
    id: "h1",
    icon: Heading1,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    id: "h2",
    icon: Heading2,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    id: "h3",
    icon: Heading3,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
    },
  },
  {
    id: "bullet",
    icon: List,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: "ordered",
    icon: ListOrdered,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: "todo",
    icon: ListTodo,
    requiredExtension: "taskList",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: "quote",
    icon: Quote,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: "code",
    icon: Code,
    requiredExtension: "codeBlock",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    id: "divider",
    icon: Minus,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

const ID_TO_KEY: Record<string, { label: string; description: string; keywords: string }> = {
  h1: { label: "slashH1Label", description: "slashH1Description", keywords: "slashH1Keywords" },
  h2: { label: "slashH2Label", description: "slashH2Description", keywords: "slashH2Keywords" },
  h3: { label: "slashH3Label", description: "slashH3Description", keywords: "slashH3Keywords" },
  bullet: { label: "slashBulletLabel", description: "slashBulletDescription", keywords: "slashBulletKeywords" },
  ordered: { label: "slashOrderedLabel", description: "slashOrderedDescription", keywords: "slashOrderedKeywords" },
  todo: { label: "slashTodoLabel", description: "slashTodoDescription", keywords: "slashTodoKeywords" },
  quote: { label: "slashQuoteLabel", description: "slashQuoteDescription", keywords: "slashQuoteKeywords" },
  code: { label: "slashCodeLabel", description: "slashCodeDescription", keywords: "slashCodeKeywords" },
  divider: { label: "slashDividerLabel", description: "slashDividerDescription", keywords: "slashDividerKeywords" },
};

/** Hook 回傳已翻譯的 slash command items；必須在 client component 內使用 */
export function useSlashCommandItems(): SlashCommandItem[] {
  const t = useTranslations("editor");
  return useMemo(
    () =>
      SLASH_COMMAND_DEFS.map((def) => {
        const keys = ID_TO_KEY[def.id];
        return {
          id: def.id,
          icon: def.icon,
          requiredExtension: def.requiredExtension,
          command: def.command,
          label: t(keys.label),
          description: t(keys.description),
          keywords: t(keys.keywords).split("|").filter(Boolean),
        };
      }),
    [t],
  );
}

/** 根據 query 字串 filter 項目，並排除 editor 未載入的 extension */
export function filterSlashItems(
  items: SlashCommandItem[],
  query: string,
  editor?: Editor,
): SlashCommandItem[] {
  let filtered = items;

  if (editor) {
    const loadedExtensions = new Set(editor.extensionManager.extensions.map((e) => e.name));
    filtered = filtered.filter(
      (item) => !item.requiredExtension || loadedExtensions.has(item.requiredExtension),
    );
  }

  if (!query) return filtered;
  const q = query.toLowerCase();
  return filtered.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}

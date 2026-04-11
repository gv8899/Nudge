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

export interface SlashCommandItem {
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  /** Extension name required for this item (used to auto-hide when extension is not loaded) */
  requiredExtension?: string;
  command: (args: { editor: Editor; range: Range }) => void;
}

export const slashCommandItems: SlashCommandItem[] = [
  {
    label: "Heading 1",
    description: "大標題",
    icon: Heading1,
    keywords: ["h1", "head", "heading", "標題", "title"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 1 })
        .run();
    },
  },
  {
    label: "Heading 2",
    description: "中標題",
    icon: Heading2,
    keywords: ["h2", "head", "heading", "標題"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 2 })
        .run();
    },
  },
  {
    label: "Heading 3",
    description: "小標題",
    icon: Heading3,
    keywords: ["h3", "head", "heading", "標題"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 3 })
        .run();
    },
  },
  {
    label: "項目符號列表",
    description: "Bullet list",
    icon: List,
    keywords: ["list", "bullet", "ul", "項目"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    label: "數字列表",
    description: "Numbered list",
    icon: ListOrdered,
    keywords: ["ol", "number", "ordered", "數字"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    label: "待辦列表",
    description: "Checkbox task list",
    icon: ListTodo,
    keywords: ["todo", "task", "check", "待辦"],
    requiredExtension: "taskList",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    label: "引言",
    description: "Blockquote",
    icon: Quote,
    keywords: ["quote", "blockquote", "引用", "引言"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    label: "程式碼區塊",
    description: "Code block",
    icon: Code,
    keywords: ["code", "block", "程式"],
    requiredExtension: "codeBlock",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleCodeBlock()
        .run();
    },
  },
  {
    label: "分隔線",
    description: "Horizontal rule",
    icon: Minus,
    keywords: ["hr", "divider", "separator", "分隔"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

/** 根據 query 字串 filter 項目，並排除 editor 未載入的 extension */
export function filterSlashItems(query: string, editor?: Editor): SlashCommandItem[] {
  let items = slashCommandItems;

  // Filter out items whose required extension is not loaded
  if (editor) {
    const loadedExtensions = new Set(editor.extensionManager.extensions.map((e) => e.name));
    items = items.filter((item) => !item.requiredExtension || loadedExtensions.has(item.requiredExtension));
  }

  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q))
  );
}

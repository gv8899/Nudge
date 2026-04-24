// src/components/editor/slash-command-defs.ts
import type { Editor, Range } from "@tiptap/core";

export interface SlashCommandDef {
  id: string;
  requiredExtension?: string;
  command: (args: { editor: Editor; range: Range }) => void;
}

export interface SlashCommandItem extends SlashCommandDef {
  label: string;
  description: string;
  keywords: string[];
}

export const SLASH_COMMAND_DEFS: SlashCommandDef[] = [
  {
    id: "text",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    id: "h1",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    id: "h2",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    id: "h3",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
    },
  },
  {
    id: "bullet",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: "ordered",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: "todo",
    requiredExtension: "taskList",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: "quote",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: "code",
    requiredExtension: "codeBlock",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    id: "divider",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

export function filterSlashItems<T extends SlashCommandItem>(
  items: T[],
  query: string,
  editor?: Editor,
): T[] {
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

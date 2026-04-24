import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { lowlight } from "./lowlight-instance";
import { slashCommandExtension } from "./slash-command-extension";
import { CodeBlockNodeView } from "./code-block-node-view";
import { SplitTaskList } from "./split-task-list";
import type { SlashCommandItem } from "./slash-command-items";

interface CreateEditorExtensionsOptions {
  placeholder: string;
  slashItems: SlashCommandItem[];
  taskList?: boolean;
  codeBlock?: boolean;
}

export function createEditorExtensions({
  placeholder,
  slashItems,
  taskList = true,
  codeBlock = true,
}: CreateEditorExtensionsOptions) {
  const extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
    }),
    Placeholder.configure({ placeholder }),
    slashCommandExtension.configure({ items: slashItems }),
  ];

  if (taskList) {
    extensions.push(
      TaskList as any,
      TaskItem.configure({ nested: false }) as any,
      SplitTaskList as any,
    );
  }

  if (codeBlock) {
    extensions.push(
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockNodeView);
        },
      }).configure({
        lowlight,
        defaultLanguage: "plaintext",
      }) as any,
    );
  }

  return extensions;
}

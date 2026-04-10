import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { lowlight } from "./lowlight-instance";
import { slashCommandExtension } from "./slash-command-extension";
import { CodeBlockNodeView } from "./code-block-node-view";

interface CreateEditorExtensionsOptions {
  placeholder: string;
}

export function createEditorExtensions({
  placeholder,
}: CreateEditorExtensionsOptions) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
    }),
    Placeholder.configure({ placeholder }),
    TaskList,
    TaskItem.configure({ nested: true }),
    CodeBlockLowlight.extend({
      addNodeView() {
        return ReactNodeViewRenderer(CodeBlockNodeView);
      },
    }).configure({
      lowlight,
      defaultLanguage: "plaintext",
    }),
    slashCommandExtension,
  ];
}

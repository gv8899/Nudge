import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { lowlight } from "./lowlight-instance";
import { slashCommandExtension } from "./slash-command-extension";
import { CodeBlockNodeView } from "./code-block-node-view";
import type { SlashCommandItem } from "./slash-command-items";

/**
 * 自動拆分 taskList — 確保每個 taskList 只包含一個 taskItem，
 * 讓每個 checkbox 都是獨立的 top-level block，可以單獨拖移。
 * 適用於任何來源：Enter 新建、貼上、載入既有內容。
 */
const SplitTaskList = Extension.create({
  name: "splitTaskList",

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;

        // 找到 taskItem ancestor
        let taskItemDepth = -1;
        for (let d = $from.depth; d >= 1; d--) {
          if ($from.node(d).type.name === "taskItem") {
            taskItemDepth = d;
            break;
          }
        }
        if (taskItemDepth === -1) return false;

        // 找到包含它的 taskList
        const taskListDepth = taskItemDepth - 1;
        if (taskListDepth < 0) return false;
        const taskList = $from.node(taskListDepth);
        if (taskList.type.name !== "taskList") return false;

        const taskItem = $from.node(taskItemDepth);
        const taskListType = state.schema.nodes.taskList;
        const taskItemType = state.schema.nodes.taskItem;

        // 如果 taskItem 內容為空，轉成普通段落（退出 checkbox 模式）
        if (taskItem.textContent === "") {
          const taskListPos = $from.before(taskListDepth);
          const paragraph = state.schema.nodes.paragraph.create();
          const tr = state.tr;
          tr.replaceWith(taskListPos, taskListPos + taskList.nodeSize, paragraph);
          tr.setSelection(TextSelection.near(tr.doc.resolve(taskListPos)));
          editor.view.dispatch(tr);
          return true;
        }

        // 建一個新的獨立 taskList（單 item）插到當前 taskList 後面
        const newItem = taskItemType.create(
          { checked: false },
          state.schema.nodes.paragraph.create()
        );
        const newList = taskListType.create(null, newItem);

        const taskListPos = $from.before(taskListDepth);
        const taskListEnd = taskListPos + taskList.nodeSize;

        const tr = state.tr;
        tr.insert(taskListEnd, newList);
        // cursor 定位到新 taskItem 的段落內（taskListEnd + taskList(1) + taskItem(1) + paragraph(1) = +3）
        tr.setSelection(TextSelection.near(tr.doc.resolve(taskListEnd + 3)));
        editor.view.dispatch(tr);
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("splitTaskList"),
        appendTransaction(_transactions, _oldState, newState) {
          const { doc, schema } = newState;
          const taskListType = schema.nodes.taskList;
          if (!taskListType) return null;

          let tr = newState.tr;
          let changed = false;

          // 從後往前找，避免位置偏移問題
          const toSplit: Array<{ pos: number; node: typeof doc }> = [];
          doc.forEach((node, pos) => {
            if (node.type === taskListType && node.childCount > 1) {
              toSplit.push({ pos, node: node as any });
            }
          });

          for (let i = toSplit.length - 1; i >= 0; i--) {
            const { pos, node } = toSplit[i];
            const items: any[] = [];
            (node as any).forEach((child: any) => {
              items.push(taskListType.create(null, child));
            });

            // 用多個單 item taskList 替換原本的多 item taskList
            tr.replaceWith(pos, pos + (node as any).nodeSize, items);
            changed = true;
          }

          return changed ? tr : null;
        },
      }),
    ];
  },
});

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

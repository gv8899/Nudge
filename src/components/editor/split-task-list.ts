import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

/**
 * 自動拆分 taskList — 確保每個 taskList 只包含一個 taskItem，
 * 讓每個 checkbox 都是獨立的 top-level block，可以單獨拖移。
 * 適用於任何來源：Enter 新建、貼上、載入既有內容。
 *
 * 純 ProseMirror，無 React 依賴；iOS / web 共用。
 */
export const SplitTaskList = Extension.create({
  name: "splitTaskList",

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;

        let taskItemDepth = -1;
        for (let d = $from.depth; d >= 1; d--) {
          if ($from.node(d).type.name === "taskItem") {
            taskItemDepth = d;
            break;
          }
        }
        if (taskItemDepth === -1) return false;

        const taskListDepth = taskItemDepth - 1;
        if (taskListDepth < 0) return false;
        const taskList = $from.node(taskListDepth);
        if (taskList.type.name !== "taskList") return false;

        const taskItem = $from.node(taskItemDepth);
        const taskListType = state.schema.nodes.taskList;
        const taskItemType = state.schema.nodes.taskItem;

        if (taskItem.textContent === "") {
          const taskListPos = $from.before(taskListDepth);
          const paragraph = state.schema.nodes.paragraph.create();
          const tr = state.tr;
          tr.replaceWith(taskListPos, taskListPos + taskList.nodeSize, paragraph);
          tr.setSelection(TextSelection.near(tr.doc.resolve(taskListPos)));
          editor.view.dispatch(tr);
          return true;
        }

        const newItem = taskItemType.create(
          { checked: false },
          state.schema.nodes.paragraph.create()
        );
        const newList = taskListType.create(null, newItem);

        const taskListPos = $from.before(taskListDepth);
        const taskListEnd = taskListPos + taskList.nodeSize;

        const tr = state.tr;
        tr.insert(taskListEnd, newList);
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

            tr.replaceWith(pos, pos + (node as any).nodeSize, items);
            changed = true;
          }

          return changed ? tr : null;
        },
      }),
    ];
  },
});

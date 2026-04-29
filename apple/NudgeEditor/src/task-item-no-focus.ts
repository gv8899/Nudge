// apple/NudgeEditor/src/task-item-no-focus.ts
//
// 蓋掉 @tiptap/extension-task-item 內建的 checkbox click handler。
//
// 內建版：`editor.chain().focus(void 0, { scrollIntoView: false }).command(...)`
// 在 editor 從未被 focus 過時，`view.focus()` 會把瀏覽器（含 WKWebView）
// 的 contentEditable caret 放到 trailing paragraph / doc 末端 →
// ProseMirror domObserver 偵測到 DOM selection 變動、dispatch setSelection
// tx，於是 cursor 飛到最底。
//
// 參考：https://github.com/ueberdosis/tiptap/issues/2172
//
// 修法：直接 view.dispatch(view.state.tr.setNodeMarkup(...))，不碰 selection、
// 不呼叫 view.focus()。toggling checkbox 本不該動使用者 selection。
import TaskItem from "@tiptap/extension-task-item";

export const NudgeTaskItem = TaskItem.extend({
  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement("li");
      const checkboxWrapper = document.createElement("label");
      const checkboxStyler = document.createElement("span");
      const checkbox = document.createElement("input");
      const content = document.createElement("div");

      const updateA11Y = (currentNode: typeof node) => {
        const a11yLabel = (
          this.options as {
            a11y?: { checkboxLabel?: (n: typeof node, c: boolean) => string };
          }
        ).a11y?.checkboxLabel?.(currentNode, checkbox.checked);
        checkbox.ariaLabel =
          a11yLabel ||
          `Task item checkbox for ${
            currentNode.textContent || "empty task item"
          }`;
      };
      updateA11Y(node);

      checkboxWrapper.contentEditable = "false";
      checkbox.type = "checkbox";
      checkbox.addEventListener("mousedown", (event) => event.preventDefault());

      checkbox.addEventListener("change", (event) => {
        const target = event.target as HTMLInputElement;
        const onReadOnlyChecked = (
          this.options as {
            onReadOnlyChecked?: (n: typeof node, c: boolean) => boolean;
          }
        ).onReadOnlyChecked;

        if (!editor.isEditable && !onReadOnlyChecked) {
          checkbox.checked = !checkbox.checked;
          return;
        }

        const checked = target.checked;

        if (editor.isEditable && typeof getPos === "function") {
          const position = getPos();
          if (typeof position !== "number") return;
          const view = editor.view;
          const currentNode = view.state.doc.nodeAt(position);
          if (!currentNode) return;
          const tr = view.state.tr.setNodeMarkup(position, undefined, {
            ...currentNode.attrs,
            checked,
          });
          view.dispatch(tr);
        }

        if (!editor.isEditable && onReadOnlyChecked) {
          if (!onReadOnlyChecked(node, checked)) {
            checkbox.checked = !checkbox.checked;
          }
        }
      });

      Object.entries(this.options.HTMLAttributes ?? {}).forEach(
        ([key, value]) => {
          listItem.setAttribute(key, value as string);
        },
      );
      listItem.dataset.checked = String(node.attrs.checked);
      checkbox.checked = node.attrs.checked;
      checkboxWrapper.append(checkbox, checkboxStyler);
      listItem.append(checkboxWrapper, content);
      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value as string);
      });

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) return false;
          listItem.dataset.checked = String(updatedNode.attrs.checked);
          checkbox.checked = updatedNode.attrs.checked;
          updateA11Y(updatedNode);
          return true;
        },
      };
    };
  },
});

// apple/NudgeEditor/src/main.ts
//
// iOS / macOS TipTap bundle entry point. Builds extensions directly from
// @tiptap/* packages — does NOT import src/components/editor/editor-extensions.ts
// (which transitively pulls React via ReactNodeViewRenderer / lucide-react).
//
// Shared with the web side only:
//   - SLASH_COMMAND_DEFS / filterSlashItems (pure data)
//   - SplitTaskList (pure ProseMirror, no React)
import { Editor, Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import {
  SLASH_COMMAND_DEFS,
  filterSlashItems,
  type SlashCommandItem,
} from "@web-editor/slash-command-defs";
import { SplitTaskList } from "@web-editor/split-task-list";
import { postToNative, type ActiveMarks } from "./bridge";
import { mountSlashMenu, type SlashMenuHandle } from "./slash-menu";
import "./theme.css";

interface LabelDict {
  [id: string]: { label: string; description: string; keywords: string };
}

let editor: Editor | null = null;
let labels: LabelDict = {};
// Single source of truth for the Placeholder extension. Read via a function
// passed to Placeholder.configure() so mutations are picked up on every
// decoration recompute. Mutating `ext.options.placeholder` directly does NOT
// work because Tiptap's ExtensionManager clones extensions — the instance
// returned by `extensionManager.extensions.find()` is not the same object the
// plugin's `this` closes over.
let currentPlaceholder = "";

function buildSlashItems(): SlashCommandItem[] {
  return SLASH_COMMAND_DEFS.map((def) => {
    const entry = labels[def.id] ?? { label: def.id, description: "", keywords: "" };
    return {
      ...def,
      label: entry.label,
      description: entry.description,
      keywords: entry.keywords.split("|").filter(Boolean),
    };
  });
}

function computeActive(): ActiveMarks {
  if (!editor) {
    return {
      heading: null, bulletList: false, orderedList: false,
      taskList: false, canUndo: false, canRedo: false,
    };
  }
  const heading =
    editor.isActive("heading", { level: 1 }) ? 1
    : editor.isActive("heading", { level: 2 }) ? 2
    : editor.isActive("heading", { level: 3 }) ? 3
    : null;
  return {
    heading,
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    taskList: editor.isActive("taskList"),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
  };
}

function createSlashCommandExtension() {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "/",
          command: ({
            editor: ed,
            range,
            props,
          }: {
            editor: any;
            range: any;
            props: { item: SlashCommandItem };
          }) => {
            props.item.command({ editor: ed, range });
          },
          items: ({ query, editor: ed }: { query: string; editor: any }) =>
            filterSlashItems(buildSlashItems(), query, ed),
          render: () => {
            let handle: SlashMenuHandle | null = null;
            return {
              onStart(props: any) {
                handle = mountSlashMenu(
                  {
                    items: props.items as SlashCommandItem[],
                    command: (item: SlashCommandItem) => props.command({ item }),
                    clientRect: props.clientRect,
                  },
                  labels,
                );
              },
              onUpdate(props: any) {
                handle?.update({
                  items: props.items as SlashCommandItem[],
                  command: (item: SlashCommandItem) => props.command({ item }),
                  clientRect: props.clientRect,
                });
              },
              onKeyDown(props: any) {
                return handle?.onKeyDown(props.event) ?? false;
              },
              onExit() {
                handle?.destroy();
                handle = null;
              },
            };
          },
        }),
      ];
    },
  });
}

function createEditor() {
  editor = new Editor({
    element: document.getElementById("editor") as HTMLElement,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({
        placeholder: () => currentPlaceholder,
        showOnlyCurrent: false,
      }),
      TaskList,
      TaskItem.configure({ nested: false }),
      // openOnClick: false — contenteditable 裡 ProseMirror 直接 open
      // 會和 caret 移動衝突。我們在 DOM 層自己攔 click → postToNative,
      // Swift 用 UIApplication.open() 開外部瀏覽器。
      // autolink: true — 輸入 URL 自動 linkify。
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "nudge-link" },
      }),
      // SplitTaskList — disabled alongside slash-command while isolating
      // the "typed character disappears" bug on iOS WKWebView. Its
      // appendTransaction walks the doc on every transaction; theoretical
      // risk of interacting with hardware-keyboard-path input delivery.
      // SplitTaskList,
      // Slash-command extension temporarily disabled — its Suggestion
      // plugin installs a keydown handler at the ProseMirror plugin layer;
      // suspected of swallowing input events on iOS WKWebView. Will
      // reintroduce once input path is confirmed solid.
      // createSlashCommandExtension(),
    ],
    content: "",
    editorProps: {
      attributes: { class: "ProseMirror" },
    },
    onUpdate: ({ editor: ed }) => {
      postToNative({ kind: "change", html: ed.getHTML() });
      postToNative({ kind: "selection", active: computeActive() });
    },
    onSelectionUpdate: () => {
      postToNative({ kind: "selection", active: computeActive() });
    },
    onFocus: () => postToNative({ kind: "focus", focused: true }),
    onBlur: () => postToNative({ kind: "focus", focused: false }),
  });

  const editorEl = document.getElementById("editor")!;

  // Delegate click on anchors → native. contenteditable 下 <a> 直接
  // click 預設不會 navigate（只移 caret），我們攔在 capture phase
  // preventDefault 並把 URL 丟回 Swift。使用者編輯 URL 可以 long-press
  // 選取或用鍵盤移 caret 進 URL 文字。
  editorEl.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement | null;
      const anchor = t?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      postToNative({ kind: "openURL", url: href });
    },
    true,
  );

  // NOTE on iOS focus: an earlier version installed a capture-phase
  // pointerdown listener that called editor.commands.focus() (later
  // editor.view.focus()) to get iOS to raise the keyboard. With the title
  // TextField now living inside the view body (not a NavigationStack
  // ToolbarItem.principal), iOS correctly routes the UITextInput session
  // to WKWebView on tap, so ProseMirror's own tap handler raises the
  // keyboard, sets selection at tap position, and receives keystrokes
  // normally. A manual focus listener here either raced ProseMirror's
  // selection (view.focus: DOM focus without selection → keystrokes
  // land nowhere) or forced the selection to doc-end, overriding tap
  // position. Trust ProseMirror's built-in handling.

  // Measure the editor container (not the body). Using body.scrollHeight +
  // min-height:100vh creates a feedback loop: body grows → viewport grows →
  // 100vh grows → body grows. Dedupe to avoid tight-loop postMessage spam.
  let lastHeight = 0;
  const ro = new ResizeObserver(() => {
    const h = Math.ceil(editorEl.getBoundingClientRect().height);
    if (Math.abs(h - lastHeight) >= 1) {
      lastHeight = h;
      postToNative({ kind: "height", value: h });
    }
  });
  ro.observe(editorEl);
}

interface NudgeEditorAPI {
  load(html: string): void;
  getHTML(): string;
  exec(command: string, args?: Record<string, unknown>): void;
  focus(): void;
  setTheme(tokens: Record<string, string>): void;
  setLabels(dict: LabelDict): void;
  setPlaceholder(text: string): void;
}

const api: NudgeEditorAPI = {
  load(html: string) {
    if (!editor) return;
    editor.commands.setContent(html || "", { emitUpdate: false });
  },
  getHTML() {
    return editor?.getHTML() ?? "";
  },
  exec(command: string, args?: Record<string, unknown>) {
    if (!editor) return;
    const chain = editor.chain().focus();
    switch (command) {
      case "toggleHeading":
        (chain as any).toggleHeading({ level: (args?.level as number) ?? 1 }).run();
        break;
      case "toggleBulletList":
        chain.toggleBulletList().run();
        break;
      case "toggleOrderedList":
        chain.toggleOrderedList().run();
        break;
      case "toggleTaskList":
        (chain as any).toggleTaskList().run();
        break;
      case "undo":
        chain.undo().run();
        break;
      case "redo":
        chain.redo().run();
        break;
      case "blur":
        editor.commands.blur();
        break;
      default:
        console.warn("[NudgeEditor] unknown command", command);
    }
  },
  focus() {
    if (!editor) return;
    editor.view.focus();
  },
  setTheme(tokens: Record<string, string>) {
    const root = document.documentElement;
    const map: Record<string, string> = {
      background: "--nudge-background",
      foreground: "--nudge-foreground",
      primary: "--nudge-primary",
      textDim: "--nudge-text-dim",
      border: "--nudge-border",
      borderLight: "--nudge-border-light",
    };
    for (const [k, cssVar] of Object.entries(map)) {
      const v = tokens[k];
      if (v) root.style.setProperty(cssVar, v);
    }
  },
  setLabels(dict: LabelDict) {
    labels = dict;
  },
  setPlaceholder(text: string) {
    currentPlaceholder = text;
    // updateState() forces ProseMirror to re-run the Placeholder ext's
    // decoration callback, which reads `currentPlaceholder` via closure.
    if (editor) {
      editor.view.updateState(editor.state);
    }
  },
};

(window as any).NudgeEditor = api;

createEditor();
postToNative({ kind: "ready" });

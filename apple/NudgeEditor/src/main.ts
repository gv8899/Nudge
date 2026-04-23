// apple/NudgeEditor/src/main.ts
import { Editor, Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { createEditorExtensions } from "@web-editor/editor-extensions";
import {
  SLASH_COMMAND_DEFS,
  filterSlashItems,
  type SlashCommandItem,
} from "@web-editor/slash-command-defs";
import { postToNative, type ActiveMarks } from "./bridge";
import { mountSlashMenu, type SlashMenuHandle } from "./slash-menu";
import "./theme.css";

interface LabelDict {
  [id: string]: { label: string; description: string; keywords: string };
}

let editor: Editor | null = null;
let labels: LabelDict = {};
let suppressChange = false;

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

// iOS-specific slash command extension — replaces the web's React-based renderer
// with a plain-DOM SlashMenu. Built from scratch using Suggestion so we don't
// inherit the React render baked into the web's slashCommandExtension.
function createIOSSlashCommandExtension() {
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

function createEditor(placeholder: string) {
  // Filter out slashCommand (web's React renderer) and codeBlock (uses ReactNodeViewRenderer).
  // We add our own iOS slashCommand extension below.
  const baseExts = createEditorExtensions({
    placeholder,
    slashItems: buildSlashItems() as any,
    codeBlock: false,
  }).filter((e: any) => e.name !== "slashCommand");

  editor = new Editor({
    element: document.getElementById("editor") as HTMLElement,
    extensions: [...baseExts, createIOSSlashCommandExtension()],
    content: "",
    editorProps: {
      attributes: { class: "ProseMirror" },
    },
    onUpdate: ({ editor: ed }) => {
      if (!suppressChange) {
        postToNative({ kind: "change", html: ed.getHTML() });
      }
      postToNative({ kind: "selection", active: computeActive() });
    },
    onSelectionUpdate: () => {
      postToNative({ kind: "selection", active: computeActive() });
    },
    onFocus: () => postToNative({ kind: "focus", focused: true }),
    onBlur: () => postToNative({ kind: "focus", focused: false }),
  });

  const ro = new ResizeObserver(() => {
    postToNative({ kind: "height", value: document.body.scrollHeight });
  });
  ro.observe(document.body);
}

interface NudgeEditorAPI {
  load(html: string): void;
  getHTML(): string;
  exec(command: string, args?: Record<string, unknown>): void;
  focus(): void;
  setTheme(tokens: Record<string, string>): void;
  setLabels(dict: LabelDict): void;
}

const api: NudgeEditorAPI = {
  load(html: string) {
    if (!editor) return;
    suppressChange = true;
    editor.commands.setContent(html || "", { emitUpdate: false });
    suppressChange = false;
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
    editor?.commands.focus();
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
};

(window as any).NudgeEditor = api;

// 啟動：先建一個 editor（無 placeholder），ready 送出去；Swift 側會接著呼叫 setTheme、
// setLabels、load。
createEditor("");
postToNative({ kind: "ready" });

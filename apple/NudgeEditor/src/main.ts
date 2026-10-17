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
import Link from "@tiptap/extension-link";
import { NudgeTaskItem } from "./task-item-no-focus";
import {
  SLASH_COMMAND_DEFS,
  filterSlashItems,
  type SlashCommandItem,
} from "@web-editor/slash-command-defs";
import { SplitTaskList } from "@web-editor/split-task-list";
import { AttachmentImage } from "@web-editor/attachment-image";
import { toNativeAttachmentURLs, toServerAttachmentURLs } from "@web-editor/attachment-url";
import {
  handleFileDrop,
  handleFilePaste,
  handlePickedFiles,
  type EntryPointSink,
} from "@web-editor/image-entry-points";
import { prepareImageForUpload } from "@web-editor/image-prepare";
import { isFileDrag } from "@web-editor/file-drag";
import { postToNative, type ActiveMarks, type UploadResultPayload } from "./bridge";
import { mountSlashMenu, type SlashMenuHandle } from "./slash-menu";
import { createUploader, type Uploader } from "./image-upload";
import { showBanner } from "./banner";
import { mountBlockDrag } from "./block-drag";
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

// Swift 在 EditorBridge 用 WKUserScript atDocumentStart 注入 NUDGE_PLATFORM。
const platform = (window as unknown as { NUDGE_PLATFORM?: string }).NUDGE_PLATFORM;

// 卡片圖片上傳（批次 2：僅 macOS）。Swift 在 ready 後呼叫
// setAttachmentTaskId(id|null)；沒有 taskId（新卡片尚未建立）就不給上傳。
let attachmentTaskId: string | null = null;
let uploader: Uploader | null = null;

function enableUpload(): boolean {
  return platform === "macos" && !!attachmentTaskId;
}

function buildSlashItems(): SlashCommandItem[] {
  // image 項只在 Mac 有 taskId 時出現；iOS 不給上傳。
  const allowImage = enableUpload();
  return SLASH_COMMAND_DEFS.filter((def) => allowImage || def.id !== "image").map((def) => {
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
  // Slash-command extension：mac 啟用、iOS 仍關閉。Suggestion plugin
  // 在 ProseMirror plugin 層裝 keydown handler，iOS WKWebView 上會
  // 吞掉輸入事件 (歷史 bug)。mac WKWebView 沒這問題、用 web 一樣的
  // `/` slash menu 取代以前掛在 view 上方的 EditorToolbar。Swift 端
  // 在 EditorBridge 用 WKUserScript atDocumentStart 注入 NUDGE_PLATFORM。
  const enableSlashMenu = platform === "macos";

  // 三入口共用的 sink：拖檔 / 貼上 / 檔案選擇 → uploader。
  const sink: EntryPointSink = {
    uploadFiles: (files, pos) => {
      void uploader?.uploadFiles(files, pos);
    },
    onRejected: () => showBanner(labels.imageUnsupported?.label ?? "imageUnsupported"),
  };

  // 隱藏的檔案選擇器（/ 選單「圖片」→ requestImagePick → onPickFiles → click）。
  // 只在 macOS 建；iOS 不設 onPickFiles → requestImagePick 回 false。
  let fileInput: HTMLInputElement | null = null;
  if (platform === "macos") {
    const input = document.createElement("input");
    input.type = "file";
    input.id = "nudge-file-input";
    input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.multiple = true;
    input.hidden = true;
    document.body.appendChild(input);
    fileInput = input;
  }

  editor = new Editor({
    element: document.getElementById("editor") as HTMLElement,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({
        placeholder: () => currentPlaceholder,
        showOnlyCurrent: false,
      }),
      TaskList,
      NudgeTaskItem.configure({ nested: false }),
      // openOnClick: false — contenteditable 裡 ProseMirror 直接 open
      // 會和 caret 移動衝突。我們在 DOM 層自己攔 click → postToNative,
      // Swift 用 UIApplication.open() 開外部瀏覽器。
      // autolink: true — 輸入 URL 自動 linkify。
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "nudge-link" },
      }),
      // 卡片圖片。macOS：onPickFiles 開隱藏檔案選擇器；iOS 不設 →
      // requestImagePick 回 false（只顯示、不上傳）。
      fileInput
        ? AttachmentImage.configure({
            onPickFiles: () => {
              if (enableUpload()) fileInput?.click();
            },
          })
        : AttachmentImage,
      // SplitTaskList — disabled alongside slash-command while isolating
      // the "typed character disappears" bug on iOS WKWebView. Its
      // appendTransaction walks the doc on every transaction; theoretical
      // risk of interacting with hardware-keyboard-path input delivery.
      // SplitTaskList,
      ...(enableSlashMenu ? [createSlashCommandExtension()] : []),
    ],
    content: "",
    editorProps: {
      attributes: { class: "ProseMirror" },
      // 有上傳能力才接手；handleFileDrop 對 Files 拖放一律 preventDefault
      // （非圖片也不會讓 WKWebView 導航走）。
      handleDrop: (view, event) =>
        enableUpload() ? handleFileDrop(view, event as DragEvent, sink) : false,
      handlePaste: (view, event) =>
        enableUpload() ? handleFilePaste(view, event, sink) : false,
    },
    onUpdate: ({ editor: ed }) => {
      postToNative({ kind: "change", html: toServerAttachmentURLs(ed.getHTML()) });
      postToNative({ kind: "selection", active: computeActive() });
    },
    onSelectionUpdate: () => {
      postToNative({ kind: "selection", active: computeActive() });
    },
    onFocus: () => postToNative({ kind: "focus", focused: true }),
    onBlur: () => postToNative({ kind: "focus", focused: false }),
  });

  const editorEl = document.getElementById("editor")!;

  // macOS：頂層 block 拖曳把手（對齊 Web 的 use-block-drag）。iOS 不掛。
  // 把手拖曳只帶 text/plain、不帶 Files → 不會撞到下面的檔案拖放 guard。
  if (platform === "macos") mountBlockDrag(editor, editorEl);

  const ed = editor;
  uploader = createUploader({
    editor: ed,
    getTaskId: () => attachmentTaskId,
    post: (msg) => postToNative(msg),
    prepare: prepareImageForUpload,
    onError: (code) => showBanner(labels[code]?.label ?? code),
  });

  if (fileInput) {
    const input = fileInput;
    input.addEventListener("change", () => {
      if (enableUpload()) handlePickedFiles(ed.view, input.files, sink);
      input.value = "";
    });
  }

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

  // 檔案拖進 WKWebView 預設會「導航到該檔案」把編輯器換掉。
  // - dragover：Files 一律 preventDefault（游標顯示可放）。
  // - drop：有上傳能力時交給 ProseMirror handleDrop（handleFileDrop 自己會
  //   preventDefault）；沒上傳能力（iOS / 無 taskId）或落在編輯區外則在這裡吃掉。
  //   document 層的 bubble listener 在 ProseMirror 之後跑，用 defaultPrevented 判斷。
  document.addEventListener("dragover", (e) => {
    if (isFileDrag(e.dataTransfer?.types)) e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    if (!isFileDrag(e.dataTransfer?.types)) return;
    if (!enableUpload() || !e.defaultPrevented) e.preventDefault();
  });

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
  setAttachmentTaskId(id: string | null): void;
  /** 一律回真 boolean（WKWebView 把 undefined 當 evaluation error）。 */
  uploadResult(r: UploadResultPayload): boolean;
}

const api: NudgeEditorAPI = {
  load(html: string) {
    if (!editor) return;
    editor.commands.setContent(toNativeAttachmentURLs(html || ""), { emitUpdate: false });
  },
  getHTML() {
    return toServerAttachmentURLs(editor?.getHTML() ?? "");
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
  setAttachmentTaskId(id: string | null) {
    attachmentTaskId = typeof id === "string" && id ? id : null;
  },
  uploadResult(r: UploadResultPayload) {
    return uploader ? uploader.uploadResult(r) : false;
  },
};

(window as any).NudgeEditor = api;

createEditor();
postToNative({ kind: "ready" });

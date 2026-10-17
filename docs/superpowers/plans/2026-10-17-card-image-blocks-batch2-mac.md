# 卡片圖片批次 2（Mac 上傳三入口 + Mac 拖曳把手）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mac App 的卡片編輯器可以拖檔 / 貼上 / `/` 選單插入圖片（走 bridge 上傳），並且可以用把手拖動段落與圖片，體驗對齊 Web。iOS 行為不變（只顯示）。

**Architecture:** Web 的入口邏輯（drop / paste 判斷、縮圖、把手的 slot 計算與搬移）抽成不依賴 React 的純模組放在 `src/components/editor/`，Web 與 Apple bundle 共用。Apple bundle 在 `NUDGE_PLATFORM === "macos"` 時啟用三入口與把手；上傳本體走 bridge：JS 把縮好的圖以 base64 送給 Swift，Swift 用既有 `APIClient` 多部表單 POST `/api/attachments`，結果回灌 JS 的 `finalizeImageUpload`；卡片在上傳途中被關掉時由 Swift 端的 `ImageUploadCoordinator` 做伺服器端補寫（對應 Web 的 `recoverIntoSavedDescription`）。檔案選擇視窗沿用 bundle 內的 `<input type=file>`，macOS 以 `WKUIDelegate.runOpenPanel` 接成原生面板。

**Tech Stack:** TipTap 3.22 / ProseMirror（純 TS）、Vite IIFE bundle、WKWebView + WKUIDelegate、SwiftUI、`APIClient` multipart、vitest（web: node；bundle: jsdom）、Swift Testing。

**Spec:** `docs/superpowers/specs/2026-10-16-card-image-blocks-design.md` §2（入口 / 把手行為）、§3.2（Mac 上傳）、§3.3（Mac 把手）、§5 批次 2。

## Global Constraints

- 分支 `feat/mac-image-upload`，疊在 `feat/card-live-sync` 之上（合併順序：批次 1 → 即時同步 → 本案）。
- **不做 spike 階段**（控制者裁定）：批次 1 實測 A4 已證明 Finder 拖檔的 drop 事件到得了 JS（JS `preventDefault` 後編輯器沒被換頁）。Task 6 的 drop 入口排第一個實測；若 `dataTransfer.files` 為空，退路（spec §3.2）= `NSViewRepresentable` `registerForDraggedTypes` 轉交 bridge，另開任務。
- 檔案選擇：bundle 內 `<input type=file accept="image/jpeg,image/png,image/webp,image/gif" multiple>` + macOS `WKUIDelegate.webView(_:runOpenPanelWith:initiatedByFrame:completionHandler:)`（控制者裁定，spec §3.2 二擇一）。
- Bridge 訊息（JS → native）新增：`{ kind: "upload", requestId, taskId, mime, base64, width, height }`；native → JS：`NudgeEditor.uploadResult({ requestId, ok: true, id, width, height })` 或 `{ requestId, ok: false, error: "imageTooLarge" | "imageUnsupported" | "imageUploadFailed" }`；native → JS：`NudgeEditor.setAttachmentTaskId(id | null)`。
- 上傳限制與 Web 相同：`MAX_ATTACHMENT_BYTES = 5*1024*1024`、`MAX_IMAGE_EDGE = 2048`、WebP 0.85 → JPEG 退路、GIF 原樣（`src/lib/attachments/constants.ts`）。
- 內文形態不變：`<img src="/api/attachments/<id>" data-attachment-id="<id>" width height alt="">`；上傳中 `<img data-upload-pending="true" data-upload-id="…" alt="">`。
- iOS：`NUDGE_PLATFORM === "ios"` 不註冊三入口、不掛把手；Swift 端收到 `upload` 一律回 `ok:false, error:"imageUploadFailed"`。
- 共用模組（`src/components/editor/*`）**不得 import React、不得用 `@/` alias**（bundle 的 vite 只有 `@web-editor` alias；用相對路徑 `../../lib/...`）。
- 把手演算法：`use-block-drag.ts` 的 `posAtCoords → topLevelBlockPos`、slot 計算、`tr.delete + insert` **逐行搬進純模組，不重寫**（spec §3.3）。
- 顏色：bundle 內只用 `--nudge-*` 變數；Swift 只用 `Color.nudgeXxx`（本案 Swift 無新 UI）。
- i18n：三個錯誤字串 `editor.imageTooLarge / imageUnsupported / imageUploadFailed` canonical 已有；xcstrings 要補鏡像（zh-TW / en / ja 與 `src/messages/*` 一致）。
- Apple 存檔：含上傳中 placeholder 的內文**要存**（對應 Web `shouldPersistDescription`），補寫才找得到。
- Bundle 改完必跑 `apple/NudgeEditor/build.sh`，並把 `Resources/Editor/editor.js` 一起 commit；Swift 必跑兩個 `xcodebuild` scheme + `swift test --no-parallel`（已知失敗 `TaskRepository.write/updateTitlePatches` 可接受）+ `./scripts/lint-swift-tokens.sh`。
- Web 行為不得改變（抽模組是重構）：Web 實測第 1、3、5、7、8、9 條在 Task 9 回歸。

## Review Focus

1. **Mac 卡片在上傳途中被關掉** → 圖片不得遺失：placeholder 要被存起來，Swift 端補寫把它換成正式 `<img>`。測試：T4 `ImageUploadCoordinator` 的 deliver-失敗 → recovery 路徑；T3 `replacePendingImage` Swift 鏡像測試；T10 手動 M6。
2. **拖一個非圖片檔（.pdf / .svg）進 Mac 編輯器** → 不插入、不換頁、顯示「只支援…」提示。測試：T1 `handleFileDrop` 純邏輯（rejected → onRejected + 回 true）；T10 手動 M3。
3. **貼上含文字的剪貼簿（Excel / Word）** → 貼文字，不變圖。測試：T1 `handleFilePaste`（text/plain 非空 → false）。
4. **把手拖圖片到兩段文字之間、段落拖到圖片上下** → 位置正確、文字不變、重新整理後順序正確。測試：T2 `moveBlock` 純邏輯（doc 層級）；T7 bundle 把手；T10 手動 M8–M10。
5. **自己的拖曳把手 vs 外部檔案拖入互不干擾**：把手 drag 的 `dataTransfer` 沒有 `Files` type；檔案拖入經過把手區不觸發區塊拖曳。測試：T1 `isFileDrag`（既有）；T7 bundle 的 `dragover` 分流；T10 手動 M11。

---

## File Structure

| 檔案 | 責任 |
|---|---|
| `src/components/editor/image-prepare.ts`（新，從 `src/lib/image-upload.ts` 搬純邏輯） | `ImageUploadError`、`isSupportedImageFile`、`computeResizeTarget`、`prepareImageForUpload`；無 `@/` alias |
| `src/lib/image-upload.ts`（改） | re-export 上面四個 + 保留 `uploadAttachment`（Web fetch） |
| `src/components/editor/file-drag.ts`（改） | import 改 `./image-prepare` |
| `src/components/editor/image-entry-points.ts` + `.test.ts`（新） | `handleFileDrop` / `handleFilePaste` / `handlePickedFiles` 純函式（Web 與 bundle 共用） |
| `src/components/task/tiptap-editor.tsx`（改） | 三入口改呼叫共用函式（行為不變） |
| `src/components/editor/block-drag-core.ts` + `.test.ts`（新，從 `use-block-drag.ts` 搬） | `computeDropSlots`、`nearestSlot`、`moveBlock`、`hoveredBlockFromEvent` |
| `src/components/editor/use-block-drag.ts`（改） | 改用 core（React 殼保留） |
| `apple/NudgeKit/Sources/NudgeCore/APIClient.swift`（改） | `postMultipart(_:fields:file:) -> Response` |
| `apple/NudgeKit/Sources/NudgeCore/AttachmentRepository.swift`（改） | `upload(taskId:data:mime:width:height:) -> AttachmentUploadResult` |
| `apple/NudgeKit/Sources/NudgeCore/AttachmentHTMLRewrite.swift`（新） | `replacePendingImage(html:uploadId:result:) -> String?`（Web `replacePendingImage` 鏡像） |
| `apple/NudgeKit/Sources/NudgeCore/ImageUploadCoordinator.swift`（新） | App 級：上傳 + 結果回灌 + 補寫 |
| `apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift`（改） | 解析 `upload`；`uploadResult` / `setAttachmentTaskId` 回灌；macOS `WKUIDelegate.runOpenPanel` |
| `apple/NudgeKit/Sources/NudgeUI/Components/RichTextEditor.swift`（改） | 新 prop `attachmentTaskId: String?`；`labelsDict()` 加三個錯誤字串 |
| `apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift`（改） | 傳 `attachmentTaskId: initialCard.id` |
| `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`（改） | 三個 key |
| `apple/Nudge-macOS/NudgeMacApp.swift`、`apple/Nudge-iOS/NudgeiOSApp.swift`（改） | 建 `ImageUploadCoordinator` 並 `.environment` |
| `apple/NudgeEditor/src/bridge.ts`（改） | `upload` 訊息型別 |
| `apple/NudgeEditor/src/image-upload.ts` + `.test.ts`（新） | bundle 端上傳佇列：placeholder → prepare → bridge → finalize / fail |
| `apple/NudgeEditor/src/banner.ts`（新） | 純 DOM 4 秒錯誤橫幅 |
| `apple/NudgeEditor/src/block-drag.ts`（新） | 純 DOM 把手 + 指示線，用 `block-drag-core` |
| `apple/NudgeEditor/src/main.ts`、`src/theme.css`（改） | 接三入口、把手、`uploadResult` / `setAttachmentTaskId` API、樣式 |
| `apple/NudgeKit/Sources/NudgeUI/Resources/Editor/editor.js`（重建） | bundle 產物 |
| `AGENTS.md`、`apple/NudgeEditor/README.md`、spec §3.2（改） | 備忘 + 決策記錄 |

---

### Task 1: 共用入口邏輯 `image-entry-points.ts` + `image-prepare.ts` 搬家

**Files:**
- Create: `src/components/editor/image-prepare.ts`、`src/components/editor/image-entry-points.ts`、`src/components/editor/image-entry-points.test.ts`
- Modify: `src/lib/image-upload.ts`（改成 re-export + 保留 `uploadAttachment`）、`src/components/editor/file-drag.ts:1`、`src/components/task/tiptap-editor.tsx:56-80, 155-170`
- Test: 既有 `src/lib/image-upload.test.ts`、`src/components/editor/file-drag.test.ts` 必須原樣通過

**Interfaces:**
- Produces（`image-prepare.ts`，內容從 `src/lib/image-upload.ts` 原樣搬，只改 import 為 `../../lib/attachments/constants`）：
  `ImageUploadErrorCode`、`ImageUploadError`、`isSupportedImageFile`、`computeResizeTarget`、`prepareImageForUpload`
- Produces（`image-entry-points.ts`）：
  ```ts
  export interface EntryPointSink {
    uploadFiles(files: File[], pos: number): void;
    onRejected(): void;                 // → imageUnsupported
  }
  /** editorProps.handleDrop 的純邏輯。回 true 代表事件已處理（呼叫端要 return true）。 */
  export function handleFileDrop(view: EditorView, event: DragEvent, sink: EntryPointSink): boolean;
  /** editorProps.handlePaste 的純邏輯。 */
  export function handleFilePaste(view: EditorView, event: ClipboardEvent, sink: EntryPointSink): boolean;
  /** <input type=file> onChange / 原生面板回傳。 */
  export function handlePickedFiles(view: EditorView, list: FileList | File[] | null, sink: EntryPointSink): void;
  export function afterTopLevelBlock(doc: PMNode, pos: number): number; // 從 tiptap-editor.tsx 搬
  ```
  規則逐條對齊 `tiptap-editor.tsx` 現況：drop 只在 `isFileDrag(types)` 時處理、一律 `preventDefault`、rejected → `onRejected()`、沒有圖片 → 回 true 不上傳、位置 = `posAtCoords` → `afterTopLevelBlock`（打不到 → `doc.content.size`）；paste：`text/plain` 非空 → false；沒圖也沒 rejected → false；否則 `preventDefault`，rejected → `onRejected()`，位置 = `afterTopLevelBlock(selection.to)`；picked：rejected → `onRejected()`，位置 = `afterTopLevelBlock(selection.to)`。

- [ ] **Step 1: 寫失敗測試**

```ts
// src/components/editor/image-entry-points.test.ts
import { describe, it, expect, vi } from "vitest";
import { getSchema } from "@tiptap/core";
import { generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import { AttachmentImage } from "./attachment-image";
import { handleFileDrop, handleFilePaste, handlePickedFiles, afterTopLevelBlock } from "./image-entry-points";

const exts = [StarterKit, AttachmentImage];
const schema = getSchema(exts);
const doc = schema.nodeFromJSON(generateJSON("<p>ab</p><p>cd</p>", exts)); // p1 0..4, p2 4..8

function file(type: string, name = "x"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}
function fakeView(posAtCoordsPos: number | null, selectionTo = 2) {
  return {
    state: { doc, selection: { to: selectionTo } },
    posAtCoords: () => (posAtCoordsPos === null ? null : { pos: posAtCoordsPos, inside: -1 }),
  } as unknown as import("@tiptap/pm/view").EditorView;
}
function sink() {
  return { uploadFiles: vi.fn(), onRejected: vi.fn() };
}
function dragEvent(types: string[], files: File[]): DragEvent {
  return {
    dataTransfer: { types, files },
    clientX: 0, clientY: 0,
    preventDefault: vi.fn(),
  } as unknown as DragEvent;
}
function pasteEvent(text: string, files: File[]): ClipboardEvent {
  return {
    clipboardData: { getData: (t: string) => (t === "text/plain" ? text : ""), files },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent;
}

describe("afterTopLevelBlock", () => {
  it("段落內 → 該段之後；頂層位置 → 原位", () => {
    expect(afterTopLevelBlock(doc, 1)).toBe(4);
    expect(afterTopLevelBlock(doc, 5)).toBe(8);
    expect(afterTopLevelBlock(doc, 4)).toBe(4);
    expect(afterTopLevelBlock(doc, 99)).toBe(8);
  });
});

describe("handleFileDrop", () => {
  it("不是檔案拖曳（把手）→ false、不 preventDefault", () => {
    const e = dragEvent(["text/plain"], []);
    const s = sink();
    expect(handleFileDrop(fakeView(1), e, s)).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(s.uploadFiles).not.toHaveBeenCalled();
  });
  it("圖片 → preventDefault、上傳位置在所在段落之後", () => {
    const e = dragEvent(["Files"], [file("image/png")]);
    const s = sink();
    expect(handleFileDrop(fakeView(1), e, s)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(s.uploadFiles).toHaveBeenCalledWith([expect.any(File)], 4);
    expect(s.onRejected).not.toHaveBeenCalled();
  });
  it("只有不支援的檔 → 仍攔下、onRejected、不上傳", () => {
    const e = dragEvent(["Files"], [file("application/pdf")]);
    const s = sink();
    expect(handleFileDrop(fakeView(1), e, s)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(s.onRejected).toHaveBeenCalledTimes(1);
    expect(s.uploadFiles).not.toHaveBeenCalled();
  });
  it("混合 → 上傳支援的、也提示 rejected；座標打不到 → 插在文件最後", () => {
    const e = dragEvent(["Files"], [file("image/jpeg"), file("image/svg+xml")]);
    const s = sink();
    expect(handleFileDrop(fakeView(null), e, s)).toBe(true);
    expect(s.onRejected).toHaveBeenCalledTimes(1);
    expect(s.uploadFiles).toHaveBeenCalledWith([expect.objectContaining({ type: "image/jpeg" })], 8);
  });
});

describe("handleFilePaste", () => {
  it("剪貼簿有文字 → false（交給 ProseMirror 貼文字）", () => {
    const e = pasteEvent("hello", [file("image/png")]);
    expect(handleFilePaste(fakeView(1), e, sink())).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
  it("沒圖也沒 rejected → false", () => {
    expect(handleFilePaste(fakeView(1), pasteEvent("", []), sink())).toBe(false);
  });
  it("純圖 → preventDefault、插在游標段落之後", () => {
    const e = pasteEvent("", [file("image/png")]);
    const s = sink();
    expect(handleFilePaste(fakeView(1, 5), e, s)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(s.uploadFiles).toHaveBeenCalledWith([expect.any(File)], 8);
  });
  it("只有不支援的 → 攔下 + onRejected", () => {
    const e = pasteEvent("", [file("application/pdf")]);
    const s = sink();
    expect(handleFilePaste(fakeView(1), e, s)).toBe(true);
    expect(s.onRejected).toHaveBeenCalledTimes(1);
    expect(s.uploadFiles).not.toHaveBeenCalled();
  });
});

describe("handlePickedFiles", () => {
  it("rejected 提示、支援的上傳在游標段落之後；null 不做事", () => {
    const s = sink();
    handlePickedFiles(fakeView(1, 1), [file("image/webp"), file("text/plain")], s);
    expect(s.onRejected).toHaveBeenCalledTimes(1);
    expect(s.uploadFiles).toHaveBeenCalledWith([expect.objectContaining({ type: "image/webp" })], 4);
    const s2 = sink();
    handlePickedFiles(fakeView(1), null, s2);
    expect(s2.uploadFiles).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/editor/image-entry-points.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 搬 `image-prepare.ts`**

把 `src/lib/image-upload.ts` 中 `ImageUploadErrorCode`、`ImageUploadError`、`isSupportedImageFile`、`computeResizeTarget`、`canvasToBlob`、`prepareImageForUpload` **原樣**搬到 `src/components/editor/image-prepare.ts`，檔頭 import 改成：

```ts
import { ALLOWED_IMAGE_MIMES, MAX_ATTACHMENT_BYTES, MAX_IMAGE_EDGE } from "../../lib/attachments/constants";
```

`src/lib/image-upload.ts` 改為：

```ts
export {
  ImageUploadError,
  isSupportedImageFile,
  computeResizeTarget,
  prepareImageForUpload,
  type ImageUploadErrorCode,
} from "@/components/editor/image-prepare";
import { ImageUploadError } from "@/components/editor/image-prepare";

export async function uploadAttachment(/* 原樣 */) { /* 原樣 */ }
```

`src/components/editor/file-drag.ts` 第 1 行改為 `import { isSupportedImageFile } from "./image-prepare";`。

- [ ] **Step 4: 實作 `image-entry-points.ts`**

```ts
// src/components/editor/image-entry-points.ts
// 三個插圖入口（拖檔 / 貼上 / 檔案選擇）的純邏輯。Web（tiptap-editor.tsx）與
// Apple bundle（apple/NudgeEditor/src/main.ts）共用。不得 import React / 用 @/ alias。
import type { EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { isFileDrag, splitImageFiles } from "./file-drag";

export interface EntryPointSink {
  uploadFiles(files: File[], pos: number): void;
  onRejected(): void;
}

/** 把任意 doc 位置換算成「所在頂層區塊之後」的插入點（圖片永遠是頂層區塊）。 */
export function afterTopLevelBlock(doc: PMNode, pos: number): number {
  const $pos = doc.resolve(Math.min(pos, doc.content.size));
  return $pos.depth === 0 ? $pos.pos : $pos.after(1);
}

export function handleFileDrop(view: EditorView, event: DragEvent, sink: EntryPointSink): boolean {
  if (!isFileDrag(event.dataTransfer?.types)) return false;
  // 外部檔案一律攔下，避免瀏覽器 / WKWebView 把頁面導向該檔案。
  event.preventDefault();
  const { images, rejected } = splitImageFiles(event.dataTransfer?.files);
  if (rejected.length > 0) sink.onRejected();
  if (images.length === 0) return true;
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  const pos = coords ? afterTopLevelBlock(view.state.doc, coords.pos) : view.state.doc.content.size;
  sink.uploadFiles(images, pos);
  return true;
}

export function handleFilePaste(view: EditorView, event: ClipboardEvent, sink: EntryPointSink): boolean {
  // 有文字（Excel / Word 等會同時附 PNG 轉譯）→ 交給 ProseMirror 貼文字。
  if (event.clipboardData?.getData("text/plain")) return false;
  const { images, rejected } = splitImageFiles(event.clipboardData?.files);
  if (images.length === 0 && rejected.length === 0) return false;
  event.preventDefault();
  if (rejected.length > 0) sink.onRejected();
  if (images.length === 0) return true;
  sink.uploadFiles(images, afterTopLevelBlock(view.state.doc, view.state.selection.to));
  return true;
}

export function handlePickedFiles(view: EditorView, list: FileList | File[] | null, sink: EntryPointSink): void {
  const { images, rejected } = splitImageFiles(list);
  if (rejected.length > 0) sink.onRejected();
  if (images.length === 0) return;
  sink.uploadFiles(images, afterTopLevelBlock(view.state.doc, view.state.selection.to));
}
```

- [ ] **Step 5: Web 改用共用函式（行為不變）**

`src/components/task/tiptap-editor.tsx`：
- `handleDrop: (view, event) => attachmentTaskId ? handleFileDrop(view, event, sinkRef.current) : false`
- `handlePaste: (view, event) => attachmentTaskId ? handleFilePaste(view, event, sinkRef.current) : false`
- 檔案 input `onChange`：`handlePickedFiles(editor.view, e.target.files, sinkRef.current); e.target.value = "";`
- `sinkRef = useRef<EntryPointSink>({ uploadFiles: () => {}, onRejected: () => {} })`，在既有 `useEffect` 中同步 `sinkRef.current = { uploadFiles: (files, pos) => void uploadFiles(files, pos), onRejected: () => showError("imageUnsupported") }`（與現有 `uploadFilesRef` / `showErrorRef` 同一個 effect；之後可把那兩個 ref 刪掉）。
- 刪除檔尾的本地 `afterTopLevelBlock`，改 import。

- [ ] **Step 6: 跑測試 + 型別 + lint + build**

Run: `npx vitest run src/components/editor/image-entry-points.test.ts src/lib/image-upload.test.ts src/components/editor/file-drag.test.ts` → PASS
Run: `npm test` → 全綠
Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "image-prepare|image-entry-points|image-upload|file-drag|tiptap-editor"` → 無輸出
Run: `npx eslint src/components/editor/image-prepare.ts src/components/editor/image-entry-points.ts src/components/editor/image-entry-points.test.ts src/lib/image-upload.ts src/components/editor/file-drag.ts src/components/task/tiptap-editor.tsx` → 無新錯誤
Run: `npx next build 2>&1 | tail -3` → 成功

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/image-prepare.ts src/components/editor/image-entry-points.ts src/components/editor/image-entry-points.test.ts src/lib/image-upload.ts src/components/editor/file-drag.ts src/components/task/tiptap-editor.tsx
git commit -m "refactor(editor): 插圖三入口與縮圖邏輯抽成 Web / Apple 共用純模組"
```

---

### Task 2: 把手核心 `block-drag-core.ts`（從 `use-block-drag.ts` 搬）

**Files:**
- Create: `src/components/editor/block-drag-core.ts`、`src/components/editor/block-drag-core.test.ts`
- Modify: `src/components/editor/use-block-drag.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface DropSlot { pos: number; y: number }
  export interface HoveredBlock { pos: number; top: number; height: number }
  /** 從滑鼠座標找頂層 block（含 padding 區探測與 atom block）。回 null = 保留原狀態。 */
  export function hoveredBlockAt(view: EditorView, clientX: number, clientY: number, containerRect: DOMRect): HoveredBlock | null;
  /** 預算所有合法 drop slot（逐行搬 computeSlots）。 */
  export function computeDropSlots(view: EditorView, containerRect: DOMRect): DropSlot[];
  export function nearestSlot(slots: DropSlot[], cursorY: number): DropSlot | null;
  /** 把 sourcePos 的頂層 node 搬到 slotPos（逐行搬 handleDrop 的 tr 邏輯）。回 false = 無效。 */
  export function moveBlock(view: EditorView, sourcePos: number, slotPos: number): boolean;
  /** 純 doc 版本，測試用與 moveBlock 共用：回新 tr 或 null。 */
  export function buildMoveTransaction(state: EditorState, sourcePos: number, slotPos: number): Transaction | null;
  ```

- [ ] **Step 1: 寫失敗測試（純 doc 層）**

```ts
// src/components/editor/block-drag-core.test.ts
import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import { generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import { EditorState } from "@tiptap/pm/state";
import { AttachmentImage } from "./attachment-image";
import { buildMoveTransaction, nearestSlot } from "./block-drag-core";

const exts = [StarterKit, AttachmentImage];
const schema = getSchema(exts);
function stateOf(html: string) {
  return EditorState.create({ schema, doc: schema.nodeFromJSON(generateJSON(html, exts)) });
}
const texts = (s: EditorState) => s.doc.content.content.map((n) => (n.type.name === "image" ? "[img]" : n.textContent));

describe("buildMoveTransaction", () => {
  // <p>a</p>(0..3) <img>(3..4) <p>b</p>(4..7)
  const html = '<p>a</p><img src="/api/attachments/x1" data-attachment-id="x1"><p>b</p>';
  it("圖片搬到最後", () => {
    const s = stateOf(html);
    const tr = buildMoveTransaction(s, 3, 7)!;
    expect(texts(s.apply(tr))).toEqual(["a", "b", "[img]"]);
  });
  it("最後一段搬到最前", () => {
    const s = stateOf(html);
    const tr = buildMoveTransaction(s, 4, 0)!;
    expect(texts(s.apply(tr))).toEqual(["b", "a", "[img]"]);
  });
  it("搬到自己前後（no-op slot）→ 內容不變", () => {
    const s = stateOf(html);
    expect(texts(s.apply(buildMoveTransaction(s, 3, 3)!))).toEqual(["a", "[img]", "b"]);
    expect(texts(s.apply(buildMoveTransaction(s, 3, 4)!))).toEqual(["a", "[img]", "b"]);
  });
  it("sourcePos 不是 node → null", () => {
    expect(buildMoveTransaction(stateOf(html), 1, 0)).toBeNull();
  });
});

describe("nearestSlot", () => {
  it("取距離最近者，空陣列 → null", () => {
    const slots = [{ pos: 0, y: 0 }, { pos: 4, y: 40 }, { pos: 8, y: 80 }];
    expect(nearestSlot(slots, 55)?.pos).toBe(4);
    expect(nearestSlot(slots, 61)?.pos).toBe(8);
    expect(nearestSlot([], 10)).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/editor/block-drag-core.test.ts` → FAIL

- [ ] **Step 3: 實作 core（逐行搬）**

```ts
// src/components/editor/block-drag-core.ts
// 頂層 block 拖放排序的核心（從 use-block-drag.ts 逐行搬出，不改演算法）。
// Web（use-block-drag.ts React 殼）與 Apple bundle（apple/NudgeEditor/src/block-drag.ts
// 純 DOM 殼）共用。不得 import React。
import type { EditorView } from "@tiptap/pm/view";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { topLevelBlockPos } from "./block-pos";

export interface DropSlot { pos: number; y: number }
export interface HoveredBlock { pos: number; top: number; height: number }

export function hoveredBlockAt(view: EditorView, clientX: number, clientY: number, containerRect: DOMRect): HoveredBlock | null {
  const editorDom = view.dom as HTMLElement;
  const editorRect = editorDom.getBoundingClientRect();
  // 滑鼠在內容左側 padding 區（把手帶）→ 用內容左緣探測，避免清掉 hovered
  const probeX = clientX < editorRect.left ? editorRect.left + 1 : clientX;
  const coords = view.posAtCoords({ left: probeX, top: clientY });
  if (!coords) return null;
  const topLevelPos = topLevelBlockPos(view.state.doc, coords);
  if (topLevelPos === null) return null;
  const dom = view.nodeDOM(topLevelPos);
  if (!dom || !(dom instanceof HTMLElement)) return null;
  const rect = dom.getBoundingClientRect();
  return { pos: topLevelPos, top: rect.top - containerRect.top, height: rect.height };
}

export function computeDropSlots(view: EditorView, containerRect: DOMRect): DropSlot[] {
  const doc = view.state.doc;
  const slots: DropSlot[] = [];
  let pos = 0;
  const childCount = doc.content.childCount;
  for (let i = 0; i <= childCount; i++) {
    let y: number;
    if (i === 0) {
      const dom = view.nodeDOM(0);
      y = dom instanceof HTMLElement ? dom.getBoundingClientRect().top - containerRect.top : 0;
    } else if (i === childCount) {
      const prevStart = pos - doc.content.child(i - 1).nodeSize;
      const dom = view.nodeDOM(prevStart);
      y = dom instanceof HTMLElement ? dom.getBoundingClientRect().bottom - containerRect.top : 0;
    } else {
      const prevStart = pos - doc.content.child(i - 1).nodeSize;
      const prevDom = view.nodeDOM(prevStart);
      const nextDom = view.nodeDOM(pos);
      if (prevDom instanceof HTMLElement && nextDom instanceof HTMLElement) {
        const above = prevDom.getBoundingClientRect().bottom;
        const below = nextDom.getBoundingClientRect().top;
        y = (above + below) / 2 - containerRect.top;
      } else {
        y = 0;
      }
    }
    slots.push({ pos, y });
    if (i < childCount) pos += doc.content.child(i).nodeSize;
  }
  return slots;
}

export function nearestSlot(slots: DropSlot[], cursorY: number): DropSlot | null {
  if (!slots.length) return null;
  return slots.reduce((a, b) => (Math.abs(a.y - cursorY) <= Math.abs(b.y - cursorY) ? a : b));
}

export function buildMoveTransaction(state: EditorState, sourcePos: number, slotPos: number): Transaction | null {
  const sourceNode = state.doc.nodeAt(sourcePos);
  if (!sourceNode) return null;
  const sourceEnd = sourcePos + sourceNode.nodeSize;
  const tr = state.tr;
  tr.delete(sourcePos, sourceEnd);
  const adjustedTarget = slotPos > sourcePos ? slotPos - sourceNode.nodeSize : slotPos;
  tr.insert(adjustedTarget, sourceNode);
  return tr;
}

export function moveBlock(view: EditorView, sourcePos: number, slotPos: number): boolean {
  const tr = buildMoveTransaction(view.state, sourcePos, slotPos);
  if (!tr) return false;
  view.dispatch(tr);
  return true;
}
```

注意 `buildMoveTransaction` 的 `nodeAt(1)`：位置 1 在 `<p>a</p>` 內是文字節點（`nodeAt` 回 text node，非 null）。測試「sourcePos 不是 node → null」要改成檢查 `sourceNode.isBlock && doc.resolve(sourcePos).depth === 0`：在 `buildMoveTransaction` 開頭加 `if (!sourceNode || state.doc.resolve(sourcePos).depth !== 0) return null;`，這是對既有邏輯的**防呆加嚴**（原 hook 只會從頂層 pos 呼叫，行為不變）。

- [ ] **Step 4: `use-block-drag.ts` 改用 core**

`handleMouseMove` → `const hb = hoveredBlockAt(editor.view, e.clientX, e.clientY, containerRect); if (hb) setHoveredBlock(hb);`（保留「滑鼠在把手上不更新」那段）；`computeSlots` → `computeDropSlots(editor.view, containerRect)`；`findNearestSlot` → `nearestSlot`；`handleDrop` 的 tr 區塊 → `moveBlock(editor.view, draggingFromPos, slot.pos)`。其餘（state、drag image、cleanup）不動。

- [ ] **Step 5: 跑測試 + build**

Run: `npx vitest run src/components/editor/block-drag-core.test.ts src/components/editor/block-pos.test.ts` → PASS；`npm test` 全綠；tsc / eslint 無新錯；`npx next build` 成功。

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/block-drag-core.ts src/components/editor/block-drag-core.test.ts src/components/editor/use-block-drag.ts
git commit -m "refactor(editor): 把手拖放核心抽成共用純模組（slot 計算 / 搬移逐行搬）"
```

---

### Task 3: Swift：multipart 上傳 + `replacePendingImage` 鏡像

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeCore/APIClient.swift`（加 `postMultipart`）
- Modify: `apple/NudgeKit/Sources/NudgeCore/AttachmentRepository.swift`（加 `upload`）
- Create: `apple/NudgeKit/Sources/NudgeCore/AttachmentHTMLRewrite.swift`
- Test: `apple/NudgeKit/Tests/NudgeCoreTests/AttachmentUploadTests.swift`、`apple/NudgeKit/Tests/NudgeCoreTests/AttachmentHTMLRewriteTests.swift`

**Interfaces:**
- Produces:
  ```swift
  // APIClient
  public struct MultipartFile: Sendable { public let fieldName: String; public let filename: String; public let mime: String; public let data: Data }
  public func postMultipart<Response: Decodable>(_ path: String, fields: [String: String], file: MultipartFile) async throws -> Response
  // 400 → .server(400)、413 → .server(413)、401 → unauthorized handler + .unauthorized（沿用 perform）
  // AttachmentRepository
  public struct AttachmentUploadResult: Decodable, Sendable, Equatable { public let id: String; public let width: Int?; public let height: Int? }
  public func upload(taskId: String, data: Data, mime: String, width: Int, height: Int) async throws -> AttachmentUploadResult
  // AttachmentHTMLRewrite（鏡像 src/components/editor/attachment-url.ts 的 replacePendingImage）
  public enum AttachmentHTMLRewrite {
      /// 把 <img … data-upload-pending="true" data-upload-id="<uploadId>" …> 換成最終 tag；找不到 → nil
      public static func replacePendingImage(html: String, uploadId: String, result: AttachmentUploadResult) -> String?
  }
  ```
  先讀 `src/components/editor/attachment-url.ts` 的 `replacePendingImage` 與其測試 `attachment-url.test.ts`，輸出格式必須**字元級一致**：`<img src="/api/attachments/<id>" alt="" data-attachment-id="<id>" width="W" height="H">`（width/height 為 nil 時省略該屬性）。

- [ ] **Step 1: 寫失敗測試**

```swift
// apple/NudgeKit/Tests/NudgeCoreTests/AttachmentHTMLRewriteTests.swift
import Testing
@testable import NudgeCore

@Suite("AttachmentHTMLRewrite") struct AttachmentHTMLRewriteTests {
    let result = AttachmentUploadResult(id: "abc_1", width: 800, height: 600)

    @Test func replacesMatchingPlaceholder() {
        let html = #"<p>a</p><img data-upload-pending="true" data-upload-id="u1" alt=""><p>b</p>"#
        let out = AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: result)
        #expect(out == #"<p>a</p><img src="/api/attachments/abc_1" alt="" data-attachment-id="abc_1" width="800" height="600"><p>b</p>"#)
    }
    @Test func leavesOtherPlaceholdersAlone() {
        let html = #"<img data-upload-pending="true" data-upload-id="u2" alt="">"#
        #expect(AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: result) == nil)
    }
    @Test func omitsNilDimensions() {
        let html = #"<img data-upload-pending="true" data-upload-id="u1" alt="">"#
        let out = AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: AttachmentUploadResult(id: "x", width: nil, height: nil))
        #expect(out == #"<img src="/api/attachments/x" alt="" data-attachment-id="x">"#)
    }
    @Test func attributeOrderInsidePlaceholderDoesNotMatter() {
        let html = #"<img alt="" data-upload-id="u1" data-upload-pending="true">"#
        #expect(AttachmentHTMLRewrite.replacePendingImage(html: html, uploadId: "u1", result: result) != nil)
    }
}
```

```swift
// apple/NudgeKit/Tests/NudgeCoreTests/AttachmentUploadTests.swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("AttachmentRepository.upload", .serialized) struct AttachmentUploadTests {
    @Test func postsMultipartWithFieldsAndFile() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.httpMethod == "POST")
            #expect(request.url?.path == "/api/attachments")
            let ct = request.value(forHTTPHeaderField: "Content-Type") ?? ""
            #expect(ct.hasPrefix("multipart/form-data; boundary="))
            let boundary = ct.replacingOccurrences(of: "multipart/form-data; boundary=", with: "")
            let body = String(decoding: request.httpBody ?? request.bodyStreamData() ?? Data(), as: UTF8.self)
            #expect(body.contains("--\(boundary)\r\n"))
            #expect(body.contains(#"name="taskId""#) && body.contains("t1"))
            #expect(body.contains(#"name="width""#) && body.contains("640"))
            #expect(body.contains(#"name="file"; filename="image""#))
            #expect(body.contains("Content-Type: image/webp"))
            let data = #"{"id":"a1","mime":"image/webp","size":3,"width":640,"height":480}"#.data(using: .utf8)!
            return (data, HTTPURLResponse(url: request.url!, statusCode: 201, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!)
        }
        let api = APIClient(configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!), session: .mocked(), tokenProvider: { "t" })
        let repo = AttachmentRepository(client: api)
        let r = try await repo.upload(taskId: "t1", data: Data([1, 2, 3]), mime: "image/webp", width: 640, height: 480)
        #expect(r == AttachmentUploadResult(id: "a1", width: 640, height: 480))
    }

    @Test func mapsStatusCodes() async throws {
        for (code, expected) in [(413, 413), (400, 400)] {
            MockURLProtocol.handler = { request in
                (Data(), HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: nil)!)
            }
            let api = APIClient(configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!), session: .mocked())
            let repo = AttachmentRepository(client: api)
            do {
                _ = try await repo.upload(taskId: "t1", data: Data([1]), mime: "image/png", width: 1, height: 1)
                Issue.record("expected throw for \(code)")
            } catch let e as APIError {
                if case .server(let status, _) = e { #expect(status == expected) } else { Issue.record("wrong error \(e)") }
            }
        }
    }
}
```

`request.bodyStreamData()`：若 `MockURLProtocol` 只看得到 `httpBodyStream`，在測試 Helpers 加一個 `URLRequest` extension 把 stream 讀成 Data；若 `httpBody` 直接可用就刪掉那個 fallback。先看 `Helpers/MockURLProtocol.swift` 怎麼拿 body。

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd apple/NudgeKit && swift test --no-parallel --filter "AttachmentHTMLRewrite|AttachmentRepository.upload" 2>&1 | tail -5` → 編譯失敗

- [ ] **Step 3: 實作**

`APIClient.postMultipart`：

```swift
public struct MultipartFile: Sendable {
    public let fieldName: String
    public let filename: String
    public let mime: String
    public let data: Data
    public init(fieldName: String, filename: String, mime: String, data: Data) { … }
}

/// multipart/form-data POST（附件上傳用）。狀態碼處理沿用 perform。
public func postMultipart<Response: Decodable>(_ path: String, fields: [String: String], file: MultipartFile) async throws -> Response {
    var request = try buildRequest(method: "POST", path: path, body: Optional<Empty>.none)
    let boundary = "NudgeBoundary-\(UUID().uuidString)"
    request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
    var body = Data()
    func append(_ s: String) { body.append(s.data(using: .utf8)!) }
    for (k, v) in fields.sorted(by: { $0.key < $1.key }) {
        append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(k)\"\r\n\r\n\(v)\r\n")
    }
    append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(file.fieldName)\"; filename=\"\(file.filename)\"\r\nContent-Type: \(file.mime)\r\n\r\n")
    body.append(file.data)
    append("\r\n--\(boundary)--\r\n")
    request.httpBody = body
    return try await perform(request)
}
```

`AttachmentRepository.upload`：

```swift
public struct AttachmentUploadResult: Decodable, Sendable, Equatable {
    public let id: String
    public let width: Int?
    public let height: Int?
    public init(id: String, width: Int?, height: Int?) { … }
}

/// POST /api/attachments（Mac 編輯器 bridge 上傳）。欄位與 Web uploadAttachment 一致。
public func upload(taskId: String, data: Data, mime: String, width: Int, height: Int) async throws -> AttachmentUploadResult {
    try await client.postMultipart(
        "/api/attachments",
        fields: ["taskId": taskId, "width": String(width), "height": String(height)],
        file: MultipartFile(fieldName: "file", filename: "image", mime: mime, data: data)
    )
}
```

`AttachmentHTMLRewrite.replacePendingImage`：用 `NSRegularExpression` 找 `<img\b[^>]*>`，逐個檢查屬性含 `data-upload-pending="true"` 且 `data-upload-id="<uploadId>"`（uploadId 先 `NSRegularExpression.escapedPattern(for:)`），只換**第一個**符合的 tag；輸出格式照 Web：`<img src="/api/attachments/\(id)" alt="" data-attachment-id="\(id)"` + (width 有值 → ` width="W"`) + (height 有值 → ` height="H"`) + `>`。**先讀 Web 的 `replacePendingImage` 與測試確認細節一致（例如 `alt=""` 的位置、是否保留原 alt）；若 Web 保留原 alt，Swift 也要。**

- [ ] **Step 4: 跑測試**

Run: `cd apple/NudgeKit && swift test --no-parallel --filter "AttachmentHTMLRewrite|AttachmentRepository.upload|APIClient" 2>&1 | tail -6` → 新測試 PASS、既有不變

- [ ] **Step 5: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeCore/APIClient.swift apple/NudgeKit/Sources/NudgeCore/AttachmentRepository.swift apple/NudgeKit/Sources/NudgeCore/AttachmentHTMLRewrite.swift apple/NudgeKit/Tests/NudgeCoreTests/AttachmentUploadTests.swift apple/NudgeKit/Tests/NudgeCoreTests/AttachmentHTMLRewriteTests.swift
git commit -m "feat(apple): APIClient.postMultipart + AttachmentRepository.upload + replacePendingImage 鏡像"
```

---

### Task 4: Swift：`ImageUploadCoordinator`（上傳、回灌、關卡後補寫）+ App 接線

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/ImageUploadCoordinator.swift`
- Test: `apple/NudgeKit/Tests/NudgeCoreTests/ImageUploadCoordinatorTests.swift`
- Modify: `apple/Nudge-macOS/NudgeMacApp.swift`、`apple/Nudge-iOS/NudgeiOSApp.swift`（`@State` + 每個 `.environment(attachmentRepo)` 旁加 `.environment(imageUploads)`）

**Interfaces:**
- Consumes: `AttachmentRepository.upload`、`AttachmentHTMLRewrite.replacePendingImage`、`CardRepository.get(cardId:seedVersion:)`、`saveCardFieldWithVersionCheck`、`CardVersionStore`。
- Produces:
  ```swift
  public struct UploadRequest: Sendable { public let requestId: String; public let taskId: String; public let mime: String; public let data: Data; public let width: Int; public let height: Int }
  public enum UploadOutcome: Sendable, Equatable {
      case ok(id: String, width: Int?, height: Int?)
      case failed(code: String)   // "imageTooLarge" | "imageUnsupported" | "imageUploadFailed"
  }
  @MainActor @Observable public final class ImageUploadCoordinator {
      public init(attachments: AttachmentRepository, cards: CardRepository, client: APIClient)
      /// 上傳；完成後呼叫 deliver。deliver 回 false（webview 已不在 / eval 失敗）→ 走補寫。
      public func start(_ req: UploadRequest, deliver: @escaping @MainActor (UploadOutcome) async -> Bool)
      public private(set) var inFlightCount: Int
      /// 測試用：所有在途 Task 完成
      public func drain() async
  }
  ```
  映射：`APIError.server(413)` → `imageTooLarge`；`.server(400)` → `imageUnsupported`；其他 → `imageUploadFailed`。
  補寫（`recoverIntoSavedDescription` 鏡像）：`cards.get(cardId:, seedVersion: false)` → `replacePendingImage(html: card.description, …)`；nil → 什麼都不做；否則 `CardVersionStore.seed(cardId:updatedAt: card.updatedAt)` 再 `saveCardFieldWithVersionCheck(client:cardId:description:)`；409 → 放棄（既有政策）；失敗吞掉。

- [ ] **Step 1: 寫失敗測試**

```swift
// apple/NudgeKit/Tests/NudgeCoreTests/ImageUploadCoordinatorTests.swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("ImageUploadCoordinator", .serialized) struct ImageUploadCoordinatorTests {
    private func makeClient() -> APIClient {
        APIClient(configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!), session: .mocked(), tokenProvider: { "t" })
    }
    private func okUpload(_ request: URLRequest) -> (Data, HTTPURLResponse) {
        (#"{"id":"a1","width":10,"height":20}"#.data(using: .utf8)!,
         HTTPURLResponse(url: request.url!, statusCode: 201, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!)
    }
    private let req = UploadRequest(requestId: "r1", taskId: "t1", mime: "image/png", data: Data([1]), width: 10, height: 20)

    @MainActor @Test func deliversOkToLiveEditor() async throws {
        MockURLProtocol.handler = { r in self.okUpload(r) }
        let client = makeClient()
        let c = ImageUploadCoordinator(attachments: AttachmentRepository(client: client), cards: CardRepository(client: client), client: client)
        var got: UploadOutcome?
        c.start(req) { outcome in got = outcome; return true }
        await c.drain()
        #expect(got == .ok(id: "a1", width: 10, height: 20))
        #expect(c.inFlightCount == 0)
    }

    @MainActor @Test func mapsErrorCodes() async throws {
        MockURLProtocol.handler = { r in (Data(), HTTPURLResponse(url: r.url!, statusCode: 413, httpVersion: nil, headerFields: nil)!) }
        let client = makeClient()
        let c = ImageUploadCoordinator(attachments: AttachmentRepository(client: client), cards: CardRepository(client: client), client: client)
        var got: UploadOutcome?
        c.start(req) { outcome in got = outcome; return true }
        await c.drain()
        #expect(got == .failed(code: "imageTooLarge"))
    }

    @MainActor @Test func recoversIntoSavedDescriptionWhenEditorGone() async throws {
        var patchedBody = ""
        MockURLProtocol.handler = { r in
            switch (r.httpMethod, r.url?.path) {
            case ("POST", "/api/attachments"):
                return self.okUpload(r)
            case ("GET", "/api/tasks/t1"):
                let json = #"{"id":"t1","title":"x","description":"<p>a</p><img data-upload-pending=\"true\" data-upload-id=\"r1\" alt=\"\">","updatedAt":"2026-10-17T00:00:00.000Z","createdAt":"2026-10-17T00:00:00.000Z","status":"inbox","tags":[]}"#
                return (json.data(using: .utf8)!, HTTPURLResponse(url: r.url!, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!)
            case ("PATCH", "/api/tasks/t1"):
                patchedBody = String(decoding: r.httpBody ?? Data(), as: UTF8.self)
                let json = #"{"id":"t1","title":"x","description":"","updatedAt":"2026-10-17T00:00:01.000Z"}"#
                return (json.data(using: .utf8)!, HTTPURLResponse(url: r.url!, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!)
            default:
                return (Data(), HTTPURLResponse(url: r.url!, statusCode: 404, httpVersion: nil, headerFields: nil)!)
            }
        }
        let client = makeClient()
        let c = ImageUploadCoordinator(attachments: AttachmentRepository(client: client), cards: CardRepository(client: client), client: client)
        c.start(req) { _ in false }   // 編輯器已關
        await c.drain()
        #expect(patchedBody.contains(#"/api/attachments/a1"#))
        #expect(patchedBody.contains(#"data-attachment-id=\"a1\""#))
        #expect(!patchedBody.contains("data-upload-pending"))
        #expect(patchedBody.contains("baseUpdatedAt"))
    }
}
```

`CardDTO` 的 JSON 欄位以 `CardDTO.swift` 實際定義為準（測試的 GET 回應要能 decode）。

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd apple/NudgeKit && swift test --no-parallel --filter ImageUploadCoordinator 2>&1 | tail -5` → 編譯失敗

- [ ] **Step 3: 實作**

```swift
// apple/NudgeKit/Sources/NudgeCore/ImageUploadCoordinator.swift
import Foundation
import Observation

public struct UploadRequest: Sendable {
    public let requestId: String, taskId: String, mime: String, data: Data, width: Int, height: Int
    public init(requestId: String, taskId: String, mime: String, data: Data, width: Int, height: Int) { … }
}

public enum UploadOutcome: Sendable, Equatable {
    case ok(id: String, width: Int?, height: Int?)
    case failed(code: String)
}

/// Mac 編輯器的圖片上傳由 App 層持有：webview 關掉後上傳仍要跑完，並把結果補寫
/// 進已存檔的內文（對應 Web use-image-upload 的 recoverIntoSavedDescription）。
@MainActor
@Observable
public final class ImageUploadCoordinator {
    private let attachments: AttachmentRepository
    private let cards: CardRepository
    private let client: APIClient
    private var tasks: [String: Task<Void, Never>] = [:]
    public private(set) var inFlightCount = 0

    public init(attachments: AttachmentRepository, cards: CardRepository, client: APIClient) { … }

    public func start(_ req: UploadRequest, deliver: @escaping @MainActor (UploadOutcome) async -> Bool) {
        inFlightCount += 1
        tasks[req.requestId] = Task { [weak self] in
            guard let self else { return }
            defer { inFlightCount -= 1; tasks[req.requestId] = nil }
            let outcome: UploadOutcome
            do {
                let r = try await attachments.upload(taskId: req.taskId, data: req.data, mime: req.mime, width: req.width, height: req.height)
                outcome = .ok(id: r.id, width: r.width, height: r.height)
            } catch let e as APIError {
                if case .server(let s, _) = e, s == 413 { outcome = .failed(code: "imageTooLarge") }
                else if case .server(let s, _) = e, s == 400 { outcome = .failed(code: "imageUnsupported") }
                else { outcome = .failed(code: "imageUploadFailed") }
            } catch {
                outcome = .failed(code: "imageUploadFailed")
            }
            let delivered = await deliver(outcome)
            if !delivered, case .ok(let id, let w, let h) = outcome {
                await recover(taskId: req.taskId, uploadId: req.requestId, result: AttachmentUploadResult(id: id, width: w, height: h))
            }
        }
    }

    private func recover(taskId: String, uploadId: String, result: AttachmentUploadResult) async {
        do {
            let card = try await cards.get(cardId: taskId, seedVersion: false)
            guard let next = AttachmentHTMLRewrite.replacePendingImage(html: card.description, uploadId: uploadId, result: result) else { return }
            CardVersionStore.seed(cardId: taskId, updatedAt: card.updatedAt)
            try await saveCardFieldWithVersionCheck(client: client, cardId: taskId, description: next)
            NotificationCenter.default.post(name: CardRepository.cardDidChangeNotification, object: taskId)
        } catch {
            // 補寫盡力而為；失敗留給孤兒清理
        }
    }

    public func drain() async {
        for t in tasks.values { await t.value }
    }
}
```

（`card.description` 若是 optional 加 `?? ""`。`uploadId` 就是 bundle 送來的 `requestId` —— Task 6 會讓兩者同值。）

App 接線：Mac / iOS 兩個 App 檔各加 `@State private var imageUploads: ImageUploadCoordinator`，`init` 內 `ImageUploadCoordinator(attachments: attachmentRepo, cards: cardRepo, client: client)`，每個 `.environment(attachmentRepo)` 旁加 `.environment(imageUploads)`（Mac 兩處、iOS 一處）。

- [ ] **Step 4: 測試 + 編譯**

Run: `cd apple/NudgeKit && swift test --no-parallel --filter "ImageUploadCoordinator" 2>&1 | tail -5` → 3 PASS
Run: 兩個 `xcodebuild`（見 Global Constraints）→ 成功

- [ ] **Step 5: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeCore/ImageUploadCoordinator.swift apple/NudgeKit/Tests/NudgeCoreTests/ImageUploadCoordinatorTests.swift apple/Nudge-macOS/NudgeMacApp.swift apple/Nudge-iOS/NudgeiOSApp.swift
git commit -m "feat(apple): ImageUploadCoordinator（上傳、回灌、關卡後補寫）+ App 注入"
```

---

### Task 5: Bridge 兩端：`upload` 訊息、`uploadResult` / `setAttachmentTaskId`、macOS 檔案面板、i18n 鏡像

**Files:**
- Modify: `apple/NudgeEditor/src/bridge.ts`（型別）
- Modify: `apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift`（parse `upload`；`pushAttachmentTaskId()`；`deliverUploadResult(_:)`；macOS `WKUIDelegate`）
- Modify: `apple/NudgeKit/Sources/NudgeUI/Components/RichTextEditor.swift`（prop `attachmentTaskId: String?` 一路傳到 coordinator；`labelsDict()` 加三個錯誤字串；`webView.uiDelegate = coordinator`（macOS））
- Modify: `apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift:238-249`（`attachmentTaskId: initialCard.id`）
- Modify: `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`（`editor.imageTooLarge` / `editor.imageUnsupported` / `editor.imageUploadFailed`，三語從 `src/messages/{zh-TW,en,ja}.json` 抄）

**Interfaces:**
- Consumes: `ImageUploadCoordinator`（`@Environment(ImageUploadCoordinator.self) … : ImageUploadCoordinator?` optional 注入，與 `attachmentRepo` 同款）。
- Produces（JS 側 API，Task 6 實作本體，這裡先定型別）：
  ```ts
  // bridge.ts
  | { kind: "upload"; requestId: string; taskId: string; mime: string; base64: string; width: number; height: number }
  // window.NudgeEditor
  uploadResult(r: { requestId: string; ok: true; id: string; width: number | null; height: number | null } | { requestId: string; ok: false; error: string }): boolean; // 回 false = 找不到 placeholder
  setAttachmentTaskId(id: string | null): void;
  ```
- Swift：
  ```swift
  // EditorNativeMessage
  case upload(requestId: String, taskId: String, mime: String, base64: String, width: Int, height: Int)
  // EditorCoordinator
  var attachmentTaskId: String?      // 變動 / ready 後 pushAttachmentTaskId()
  var imageUploads: ImageUploadCoordinator?
  func pushAttachmentTaskId()        // NudgeEditor.setAttachmentTaskId(<json string or null>)
  func deliverUploadResult(_ payload: [String: Any]) async -> Bool  // evaluateJavaScript("NudgeEditor.uploadResult(<json>)") → Bool；webView nil / eval 錯 → false
  ```

- [ ] **Step 1: bridge.ts 型別**（加 `upload` 到 `NativeMessage` union。）

- [ ] **Step 2: Swift parse + 回灌**

`EditorNativeMessage.parse` 加：

```swift
case "upload":
    guard let requestId = dict["requestId"] as? String, let taskId = dict["taskId"] as? String,
          let mime = dict["mime"] as? String, let base64 = dict["base64"] as? String,
          let width = dict["width"] as? Int, let height = dict["height"] as? Int else { return nil }
    return .upload(requestId: requestId, taskId: taskId, mime: mime, base64: base64, width: width, height: height)
```

`userContentController(_:didReceive:)` 加：

```swift
case .upload(let requestId, let taskId, let mime, let base64, let width, let height):
    #if os(macOS)
    guard let imageUploads, let data = Data(base64Encoded: base64) else {
        Task { _ = await deliverUploadResult(["requestId": requestId, "ok": false, "error": "imageUploadFailed"]) }
        break
    }
    imageUploads.start(UploadRequest(requestId: requestId, taskId: taskId, mime: mime, data: data, width: width, height: height)) { [weak self] outcome in
        guard let self else { return false }
        switch outcome {
        case .ok(let id, let w, let h):
            return await self.deliverUploadResult(["requestId": requestId, "ok": true, "id": id, "width": w as Any, "height": h as Any])
        case .failed(let code):
            return await self.deliverUploadResult(["requestId": requestId, "ok": false, "error": code])
        }
    }
    #else
    Task { _ = await deliverUploadResult(["requestId": requestId, "ok": false, "error": "imageUploadFailed"]) }
    #endif
```

`deliverUploadResult`：`JSONSerialization` 成字串 → `webView.evaluateJavaScript("NudgeEditor.uploadResult(\(json))")`，用 `withCheckedContinuation` 包；結果 `as? Bool ?? false`；`webView == nil` 或 error → false。`nil` 的 width/height 要序列化成 JSON `null`（用 `NSNull()`）。

`pushAttachmentTaskId()`：在 `.ready` 分支 `pushLabels()` 之後呼叫；值變動時（`updateNSView` / `updateUIView`）也呼叫。JS 端 `null` → 關掉入口。

macOS `WKUIDelegate`（`#if os(macOS)` 內讓 `EditorCoordinator` 遵循 `WKUIDelegate`，`makeNSView` 設 `webView.uiDelegate = context.coordinator`）：

```swift
func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
             initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
    let panel = NSOpenPanel()
    panel.canChooseFiles = true
    panel.canChooseDirectories = false
    panel.allowsMultipleSelection = parameters.allowsMultipleSelection
    panel.allowedContentTypes = [.jpeg, .png, .webP, .gif]
    panel.beginSheetModal(for: webView.window ?? NSApp.keyWindow ?? NSWindow()) { resp in
        completionHandler(resp == .OK ? panel.urls : nil)
    }
}
```

（`import UniformTypeIdentifiers`。若 `webView.window` 為 nil 用 `panel.begin`。）

- [ ] **Step 3: RichTextEditor prop + labels + CardDetailView**

`RichTextEditor.init` 加 `attachmentTaskId: String? = nil`，傳進 `UIKitEditor` / `AppKitEditor` → `makeCoordinator` 後 `context.coordinator.attachmentTaskId = attachmentTaskId`、`context.coordinator.imageUploads = imageUploads`（`@Environment(ImageUploadCoordinator.self) private var imageUploads: ImageUploadCoordinator?`），`updateNSView/updateUIView` 內若值不同就更新並 `pushAttachmentTaskId()`。`labelsDict()` 加：

```swift
for key in ["imageTooLarge", "imageUnsupported", "imageUploadFailed"] {
    result[key] = ["label": NSLocalizedString("editor.\(key)", bundle: .module, comment: ""), "description": "", "keywords": ""]
}
```

`CardDetailView` 的 `RichTextEditor(` 加 `attachmentTaskId: initialCard.id,`。

xcstrings 加三個 key（zh-TW / en / ja 文案照 `src/messages/*.json` 的 `editor.imageTooLarge` 等）。

- [ ] **Step 4: 編譯 + 測試**

Run: 兩個 `xcodebuild` → 成功；`cd apple/NudgeKit && swift test --no-parallel 2>&1 | tail -4`；`./scripts/lint-swift-tokens.sh`。

- [ ] **Step 5: Commit**

```bash
git add apple/NudgeEditor/src/bridge.ts apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift apple/NudgeKit/Sources/NudgeUI/Components/RichTextEditor.swift apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings
git commit -m "feat(apple-editor): bridge upload / uploadResult / setAttachmentTaskId、macOS 檔案面板、錯誤字串鏡像"
```

---

### Task 6: Bundle：Mac 三入口 + 上傳佇列 + 錯誤橫幅

**Files:**
- Create: `apple/NudgeEditor/src/image-upload.ts`、`apple/NudgeEditor/src/image-upload.test.ts`、`apple/NudgeEditor/src/banner.ts`
- Modify: `apple/NudgeEditor/src/main.ts`、`apple/NudgeEditor/src/theme.css`
- Rebuild: `apple/NudgeEditor/build.sh` → `apple/NudgeKit/Sources/NudgeUI/Resources/Editor/editor.js`（commit）

**Interfaces:**
- Consumes: `@web-editor/image-entry-points`（T1）、`@web-editor/image-prepare`（T1）、`AttachmentImage` commands、`postToNative({kind:"upload"…})`（T5）。
- Produces:
  ```ts
  // image-upload.ts
  export interface UploaderDeps {
    editor: Editor;
    getTaskId(): string | null;
    post(msg: { kind: "upload"; requestId: string; taskId: string; mime: string; base64: string; width: number; height: number }): void;
    prepare(file: File): Promise<{ blob: Blob; mime: string; width: number; height: number }>;
    onError(code: string): void;
    newId(): string;   // 預設 crypto.randomUUID()
  }
  export function createUploader(deps: UploaderDeps): {
    uploadFiles(files: File[], pos: number): Promise<void>;   // EntryPointSink.uploadFiles
    uploadResult(r: UploadResultPayload): boolean;             // window.NudgeEditor.uploadResult
    pendingCount(): number;
  };
  ```
  行為對齊 Web `useImageUpload`：每檔立刻 `insertUploadingImage({ uploadId: requestId, previewSrc: URL.createObjectURL(file) }, pos)`（多檔 pos 遞增）；`prepare` → base64（`FileReader.readAsDataURL` 去掉前綴）→ `post`；`uploadResult ok` → `finalizeImageUpload(requestId, { id, width, height })`；`ok:false` → `failImageUpload(requestId)` + `onError(error)`；`prepare` 丟 `ImageUploadError` → `failImageUpload` + `onError(e.code)`；`finalize`/`fail` 回傳值即 `uploadResult` 的回傳值（false 代表 placeholder 不在 → Swift 走補寫）。`URL.revokeObjectURL` 在 finalize / fail 後。

- [ ] **Step 1: 寫失敗測試（bundle vitest，jsdom）**

```ts
// apple/NudgeEditor/src/image-upload.test.ts
import { describe, it, expect, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { AttachmentImage } from "@web-editor/attachment-image";
import { createUploader } from "./image-upload";

function makeEditor() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return new Editor({ element: el, extensions: [StarterKit, AttachmentImage], content: "<p>a</p>" });
}
const png = () => new File([new Uint8Array([137, 80, 78, 71])], "x.png", { type: "image/png" });

describe("createUploader", () => {
  it("插 placeholder → post upload → ok 換成正式圖", async () => {
    const editor = makeEditor();
    const post = vi.fn();
    const onError = vi.fn();
    const up = createUploader({
      editor, getTaskId: () => "t1", post, onError, newId: () => "r1",
      prepare: async () => ({ blob: new Blob([new Uint8Array([1, 2])], { type: "image/webp" }), mime: "image/webp", width: 10, height: 20 }),
    });
    await up.uploadFiles([png()], 3);
    expect(editor.getHTML()).toContain('data-upload-pending="true"');
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ kind: "upload", requestId: "r1", taskId: "t1", mime: "image/webp", width: 10, height: 20 }));
    expect(typeof post.mock.calls[0][0].base64).toBe("string");
    expect(up.pendingCount()).toBe(1);
    expect(up.uploadResult({ requestId: "r1", ok: true, id: "a1", width: 10, height: 20 })).toBe(true);
    expect(editor.getHTML()).toContain('src="/api/attachments/a1"');
    expect(up.pendingCount()).toBe(0);
    expect(onError).not.toHaveBeenCalled();
  });
  it("ok:false → 移除 placeholder + onError", async () => {
    const editor = makeEditor();
    const onError = vi.fn();
    const up = createUploader({
      editor, getTaskId: () => "t1", post: vi.fn(), onError, newId: () => "r2",
      prepare: async () => ({ blob: new Blob([new Uint8Array([1])]), mime: "image/webp", width: 1, height: 1 }),
    });
    await up.uploadFiles([png()], 3);
    expect(up.uploadResult({ requestId: "r2", ok: false, error: "imageTooLarge" })).toBe(true);
    expect(editor.getHTML()).not.toContain("data-upload-pending");
    expect(onError).toHaveBeenCalledWith("imageTooLarge");
  });
  it("prepare 失敗 → 不 post、移除 placeholder、onError(code)", async () => {
    const editor = makeEditor();
    const post = vi.fn();
    const onError = vi.fn();
    const { ImageUploadError } = await import("@web-editor/image-prepare");
    const up = createUploader({
      editor, getTaskId: () => "t1", post, onError, newId: () => "r3",
      prepare: async () => { throw new ImageUploadError("imageUnsupported"); },
    });
    await up.uploadFiles([png()], 3);
    expect(post).not.toHaveBeenCalled();
    expect(editor.getHTML()).not.toContain("data-upload-pending");
    expect(onError).toHaveBeenCalledWith("imageUnsupported");
  });
  it("沒有 taskId → 不做事；未知 requestId 的 uploadResult → false", async () => {
    const editor = makeEditor();
    const post = vi.fn();
    const up = createUploader({ editor, getTaskId: () => null, post, onError: vi.fn(), newId: () => "r4", prepare: async () => { throw new Error("no"); } });
    await up.uploadFiles([png()], 3);
    expect(post).not.toHaveBeenCalled();
    expect(up.uploadResult({ requestId: "nope", ok: false, error: "x" })).toBe(false);
  });
});
```

（jsdom 沒有 `URL.createObjectURL`：在測試檔頂端 `if (!URL.createObjectURL) { URL.createObjectURL = () => "blob:test"; URL.revokeObjectURL = () => {}; }`。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd apple/NudgeEditor && npx vitest run src/image-upload.test.ts` → FAIL

- [ ] **Step 3: 實作 `image-upload.ts`、`banner.ts`、接進 `main.ts`**

`image-upload.ts` 依上面介面實作（base64 用 `FileReader.readAsDataURL(blob)` 然後 `result.split(",")[1]`）。

`banner.ts`：

```ts
export function showBanner(text: string, ms = 4000) {
  let el = document.querySelector<HTMLElement>(".nudge-editor-banner");
  if (!el) { el = document.createElement("div"); el.className = "nudge-editor-banner"; el.setAttribute("role", "alert"); document.body.appendChild(el); }
  el.textContent = text;
  el.classList.add("is-visible");
  window.clearTimeout((el as any).__t);
  (el as any).__t = window.setTimeout(() => el!.classList.remove("is-visible"), ms);
}
```

`theme.css` 加 `.nudge-editor-banner { position: fixed; top: 8px; left: 50%; transform: translateX(-50%); background: var(--nudge-background); color: var(--nudge-foreground); border: 1px solid var(--nudge-border-light); border-radius: 8px; padding: 6px 12px; box-shadow: 0 4px 12px rgba(0,0,0,.12); opacity: 0; pointer-events: none; transition: opacity .15s; z-index: 1001; } .nudge-editor-banner.is-visible { opacity: 1; }`，以及上傳中圖片的半透明：`.ProseMirror img[data-upload-pending], .ProseMirror .nudge-image-block[data-uploading] img { opacity: .6 }`（bundle 沒有 React node view，上傳中節點以 `renderHTML` 的 `data-upload-pending` 屬性存在 DOM —— 先確認 `AttachmentImage.renderHTML` 在 pending 時輸出的屬性，照實際屬性寫選擇器；預覽 `src` 在 pending 時 **不輸出** 到 HTML 序列化，但 node view 不存在時 DOM 由 `renderHTML` 產生 → 看不到 blob 預覽。**本案接受**：Mac 上傳中只顯示一個半透明佔位（給 `min-height: 80px; background: var(--nudge-border-light)`），上傳完成換成圖；在報告記錄。）

`main.ts`：
- `let attachmentTaskId: string | null = null;`；API 加 `setAttachmentTaskId(id) { attachmentTaskId = id; }`、`uploadResult(r) { return uploader?.uploadResult(r) ?? false; }`。
- 建 `uploader = createUploader({ editor, getTaskId: () => attachmentTaskId, post: postToNative, prepare: prepareImageForUpload, onError: (code) => showBanner(labels[code]?.label ?? code) })`（`labels` 由 Swift `setLabels` 注入，T5 已加三個 key）。
- `const sink: EntryPointSink = { uploadFiles: (files, pos) => void uploader.uploadFiles(files, pos), onRejected: () => showBanner(labels.imageUnsupported?.label ?? "imageUnsupported") }`。
- `editorProps.handleDrop: (view, e) => enableUpload() ? handleFileDrop(view, e, sink) : false`，`handlePaste` 同理；`enableUpload = () => platform === "macos" && !!attachmentTaskId`。
- 把批次 1 的 document-level `dragover/drop` 守門改成：`dragover` 仍對 `Files` `preventDefault`（讓游標顯示可放）；`drop` 只在 `!enableUpload()` 時 `preventDefault`（有上傳能力時交給 `handleDrop`，它自己會 `preventDefault`）。
- 隱藏 `<input type=file id="nudge-file-input" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden>` 由 `main.ts` 建到 `document.body`；`AttachmentImage.configure({ onPickFiles: () => input.click() })`（只在 macOS）；`input.onchange = () => { handlePickedFiles(editor.view, input.files, sink); input.value = ""; }`。
- `buildSlashItems`：macOS 且 `attachmentTaskId` 時不再過濾 `image`（iOS 仍過濾）。
- `getHTML()` / `change` 不變（placeholder 會序列化成 `data-upload-pending`）。

- [ ] **Step 4: 測試 + rebuild**

Run: `cd apple/NudgeEditor && npm test` → 全綠；`apple/NudgeEditor/build.sh` → 成功；`git status` 顯示 `Resources/Editor/editor.js`（與 `editor.css` 若有）變動。

- [ ] **Step 5: Commit**

```bash
git add apple/NudgeEditor/src apple/NudgeKit/Sources/NudgeUI/Resources/Editor
git commit -m "feat(apple-editor): Mac 三入口上傳（拖檔 / 貼上 / 斜線）走 bridge + 錯誤橫幅"
```

---

### Task 7: Bundle：Mac 拖曳把手（純 DOM 殼 + 共用 core）

**Files:**
- Create: `apple/NudgeEditor/src/block-drag.ts`
- Modify: `apple/NudgeEditor/src/main.ts`、`apple/NudgeEditor/src/theme.css`
- Rebuild bundle

**Interfaces:**
- Consumes: `@web-editor/block-drag-core`（T2）。
- Produces: `mountBlockDrag(editor: Editor, container: HTMLElement, labels: { dragBlockTitle?: string }): { destroy(): void }`。

- [ ] **Step 1: 實作（行為逐條對齊 Web 的 `use-block-drag.ts` + `block-drag-handle.tsx`）**

```ts
// apple/NudgeEditor/src/block-drag.ts
import type { Editor } from "@tiptap/core";
import { hoveredBlockAt, computeDropSlots, nearestSlot, moveBlock, type DropSlot, type HoveredBlock } from "@web-editor/block-drag-core";

const EMPTY_IMG = (() => { const i = new Image(); i.src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="; return i; })();

export function mountBlockDrag(editor: Editor, container: HTMLElement) {
  container.classList.add("nudge-has-drag");
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "nudge-drag-handle";
  handle.draggable = true;
  handle.setAttribute("aria-label", "drag");
  handle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>';
  const indicator = document.createElement("div");
  indicator.className = "nudge-drop-indicator";
  container.append(handle, indicator);

  let hovered: HoveredBlock | null = null;
  let draggingFrom: number | null = null;
  let slots: DropSlot[] = [];

  const rect = () => container.getBoundingClientRect();
  const showHandle = (hb: HoveredBlock) => { hovered = hb; handle.style.display = "flex"; handle.style.top = `${hb.top + hb.height / 2 - 12}px`; };
  const hideHandle = () => { hovered = null; handle.style.display = "none"; };
  const showIndicator = (y: number) => { indicator.style.display = "block"; indicator.style.top = `${y - 1}px`; };
  const hideIndicator = () => { indicator.style.display = "none"; };

  const onMouseMove = (e: MouseEvent) => {
    if (draggingFrom !== null) return;
    if ((e.target as HTMLElement).closest(".nudge-drag-handle")) return;   // 從文字移到把手不消失
    const hb = hoveredBlockAt(editor.view, e.clientX, e.clientY, rect());
    if (hb) showHandle(hb);                                                  // 曖昧 → 保留
  };
  const onMouseLeave = () => { if (draggingFrom === null) hideHandle(); };
  const onDragStart = (e: DragEvent) => {
    if (!hovered || !e.dataTransfer) return;
    draggingFrom = hovered.pos;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "nudge-block");   // 沒有 Files type → 不會被檔案 drop 攔到
    e.dataTransfer.setDragImage(EMPTY_IMG, 0, 0);
    slots = computeDropSlots(editor.view, rect());
    const s = nearestSlot(slots, e.clientY - rect().top);
    if (s) showIndicator(s.y);
  };
  const onDragOver = (e: DragEvent) => {
    if (draggingFrom === null) return;              // 檔案拖入 → 交給 main.ts 的 Files 流程
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const s = nearestSlot(slots, e.clientY - rect().top);
    if (s) showIndicator(s.y);
  };
  const cleanup = () => { draggingFrom = null; slots = []; hideIndicator(); hideHandle(); };
  const onDrop = (e: DragEvent) => {
    if (draggingFrom === null) return;
    e.preventDefault();
    const s = nearestSlot(slots, e.clientY - rect().top);
    if (s) moveBlock(editor.view, draggingFrom, s.pos);
    cleanup();
  };
  const onDragEnd = () => { draggingFrom = null; slots = []; hideIndicator(); };

  container.addEventListener("mousemove", onMouseMove);
  container.addEventListener("mouseleave", onMouseLeave);
  handle.addEventListener("dragstart", onDragStart);
  handle.addEventListener("dragend", onDragEnd);
  container.addEventListener("dragover", onDragOver);
  container.addEventListener("drop", onDrop);
  hideHandle(); hideIndicator();

  return { destroy() { /* removeEventListener × 6；handle.remove(); indicator.remove(); */ } };
}
```

`theme.css`：

```css
#editor { position: relative; padding: 16px 16px 16px 40px; }     /* 左側留把手帶（macOS 才加 class） */
#editor.nudge-has-drag .nudge-drag-handle {
  position: absolute; left: 8px; display: none; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: 0; border-radius: 4px; background: transparent;
  color: var(--nudge-text-dim); cursor: grab; z-index: 10; padding: 0;
}
#editor.nudge-has-drag .nudge-drag-handle:hover { color: var(--nudge-foreground); background: var(--nudge-border-light); }
#editor.nudge-has-drag .nudge-drag-handle:active { cursor: grabbing; }
#editor .nudge-drop-indicator { position: absolute; left: 0; right: 0; height: 2px; background: var(--nudge-primary); pointer-events: none; z-index: 20; display: none; }
```

（padding-left 只在 macOS 加：`#editor.nudge-has-drag { padding-left: 40px; }`，iOS 維持 16px。）

`main.ts`：`if (platform === "macos") mountBlockDrag(editor, editorEl);`。

- [ ] **Step 2: 建置**

Run: `cd apple/NudgeEditor && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v SplitTaskList | head`（既有 TS6133 可忽略）；`npm test`；`./build.sh`。

- [ ] **Step 3: Commit**

```bash
git add apple/NudgeEditor/src apple/NudgeKit/Sources/NudgeUI/Resources/Editor
git commit -m "feat(apple-editor): Mac 拖曳把手（純 DOM 殼 + 共用 block-drag-core）"
```

---

### Task 8: Apple 全量建置 + 文件

**Files:**
- Modify: `AGENTS.md`（「卡片圖片」段補一句 Mac 上傳走 bridge、把手只在 macOS）、`apple/NudgeEditor/README.md`（新增「共用的東西」：`image-entry-points` / `image-prepare` / `block-drag-core`；bundle 的 `image-upload.ts`、`block-drag.ts`、`banner.ts`）、spec §3.2（記錄決策：不做 spike 的依據、檔案面板走 `WKUIDelegate`、Mac 上傳中無 blob 預覽）。

- [ ] **Step 1: 建置與測試**

```bash
cd apple && xcodegen generate >/dev/null && \
xcodebuild -project Nudge.xcodeproj -scheme Nudge-macOS -configuration Debug -derivedDataPath ~/Library/Developer/Xcode/DerivedData/nudge-ops-mac -quiet build 2>&1 | tail -5 && \
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ~/Library/Developer/Xcode/DerivedData/nudge-ops-ios -quiet build 2>&1 | tail -5
cd NudgeKit && swift test --no-parallel 2>&1 | tail -5
cd ../.. && ./scripts/lint-swift-tokens.sh && npm test 2>&1 | tail -3 && (cd apple/NudgeEditor && npm test 2>&1 | tail -3)
```

- [ ] **Step 2: 文件** — 三個檔案各加一段 / 幾句。

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md apple/NudgeEditor/README.md docs/superpowers/specs/2026-10-16-card-image-blocks-design.md
git commit -m "docs: 卡片圖片批次 2（Mac 上傳 bridge、把手）備忘與決策"
```

---

### Task 9: Web 回歸實測（Definition of Done）— 交給使用者

重構了 Web 的三入口與把手，Web 重測：批次 1 清單的第 1（拖 JPG）、3（⌘V）、4（`/` 圖片）、5（.pdf 攔下 + 橫幅）、7（把手拖圖片）、8（把手拖段落到圖片上下）、9（拖檔經過把手區）。

---

### Task 10: Mac / iOS 實測（Definition of Done）— 交給使用者

先重 build 並啟動（Mac `open -n <DerivedData>/Nudge-macOS.app`；iOS `simctl install` + `launch`）。

| # | 操作 | 期望 |
|---|---|---|
| M1 | Finder 拖一張 JPG 到 Mac 卡片兩段文字之間 | 立即出現半透明佔位；2 秒內換成圖；位置在放手處區塊之後；編輯器**沒有**被換成檔案頁 |
| M2 | 同時拖 3 張 | 3 張、順序正確 |
| M3 | 拖一個 .pdf | 不插入、編輯器不變、頂部橫幅「只支援 JPEG、PNG、WebP、GIF」4 秒消失 |
| M4 | 截圖後 ⌘V | 圖插在游標段落之後 |
| M5 | 打 `/`、選「圖片」 | 跳出原生檔案面板；選檔後插入 |
| M6 | 新卡片貼一張圖、上傳完成前就關掉；等 3 秒再開 | 圖在（Swift 端補寫） |
| M7 | 拖一張 > 5MB 的 GIF | 不插入、「圖片超過 5MB」橫幅 |
| M8 | 把手拖圖片到兩段文字之間 | 指示線正確；放開後圖片移動、文字不變 |
| M9 | 把手拖段落到圖片上 / 下 | 同上 |
| M10 | M8 之後 Web 重新整理 | 順序一致 |
| M11 | 從 Finder 拖檔時滑過把手區 | 不會變成區塊拖曳，放開仍是上傳 |
| M12 | Mac ⌘Z | 可還原刪圖；上傳完成的換網址不會被 ⌘Z 退回佔位 |
| I1 | iOS 開含圖卡片 | 看得到圖、沒有把手、`/` 無「圖片」（iOS 本來就沒 `/`） |
| I2 | iOS 改一個字存檔 → Web 重新整理 | 圖都在 |

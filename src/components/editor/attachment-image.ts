// src/components/editor/attachment-image.ts
//
// 卡片內文圖片 node。純 ProseMirror / TipTap，Web 與 Apple bundle 共用
// （Apple 經 @web-editor alias import）。不得 import React。
//
// 內文形態：<img src="/api/attachments/<id>" data-attachment-id="<id>" width height alt="">
// 上傳中：attrs.uploadId 有值、src 是 blob: 預覽；序列化時不輸出 src（避免把
// blob: 存進 DB），改輸出 data-upload-pending + data-upload-id，重新 parse 會被丟掉。
import Image from "@tiptap/extension-image";
import type { Node as PMNode } from "@tiptap/pm/model";
import { attachmentApiUrl, isAllowedImageSrc } from "./attachment-url";

export interface AttachmentImageOptions {
  /** `/` 選單「圖片」或其他入口要開檔案選擇器時呼叫；沒設 = 此平台不給上傳。 */
  onPickFiles?: () => void;
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    attachmentImage: {
      insertUploadingImage: (
        attrs: { uploadId: string; previewSrc: string; width?: number; height?: number },
        pos?: number,
      ) => ReturnType;
      finalizeImageUpload: (
        uploadId: string,
        result: { id: string; width: number | null; height: number | null },
      ) => ReturnType;
      failImageUpload: (uploadId: string) => ReturnType;
      requestImagePick: () => ReturnType;
    };
  }
}

export function findUploadingImage(
  doc: PMNode,
  uploadId: string,
): { pos: number; node: PMNode } | null {
  let found: { pos: number; node: PMNode } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === "image" && node.attrs.uploadId === uploadId) {
      found = { pos, node };
      return false;
    }
    return true;
  });
  return found;
}

export const AttachmentImage = Image.extend<AttachmentImageOptions>({
  inline: false,
  group: "block",
  // 關掉 ProseMirror 原生拖曳 — 區塊移動一律走 use-block-drag 的把手，
  // 否則圖片會多一套「直接按住圖拖」的行為，和檔案拖放撞在一起。
  draggable: false,

  addOptions() {
    return {
      ...this.parent?.(),
      onPickFiles: undefined,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      attachmentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-attachment-id"),
        renderHTML: (attrs) =>
          attrs.attachmentId ? { "data-attachment-id": attrs.attachmentId } : {},
      },
      width: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute("width");
          return v ? Number.parseInt(v, 10) || null : null;
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute("height");
          return v ? Number.parseInt(v, 10) || null : null;
        },
        renderHTML: (attrs) => (attrs.height ? { height: attrs.height } : {}),
      },
      // 上傳中的暫時識別；不輸出到 HTML。
      uploadId: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
        // 回 false = 整個節點丟掉。外站 / data: / blob: 都不收。
        getAttrs: (el) =>
          isAllowedImageSrc((el as HTMLElement).getAttribute("src")) ? null : false,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    if (node.attrs.uploadId) {
      // 上傳中：不要把 blob: 存出去。帶 data-upload-id，卡片在上傳途中被關掉時
      // use-image-upload 可以在伺服器端把這格補寫成最終圖片（見 replacePendingImage）。
      const { src: _src, ...rest } = HTMLAttributes;
      void _src;
      return [
        "img",
        { "data-upload-pending": "true", "data-upload-id": node.attrs.uploadId, ...rest },
      ];
    }
    return ["img", HTMLAttributes];
  },

  // 父類別有 Markdown `![alt](url)` input rule，會直接插外站 src 的圖（洩漏 IP、
  // 存檔後下次載入又被 parseHTML 丟掉）。內文圖片只能走上傳流程。
  addInputRules() {
    return [];
  },

  addPasteRules() {
    return [];
  },

  addCommands() {
    return {
      insertUploadingImage:
        ({ uploadId, previewSrc, width, height }, pos) =>
        ({ chain, state }) => {
          const at = pos ?? state.selection.to;
          return chain()
            .insertContentAt(at, {
              type: this.name,
              attrs: {
                src: previewSrc,
                uploadId,
                width: width ?? null,
                height: height ?? null,
                attachmentId: null,
                alt: "",
              },
            })
            .run();
        },

      finalizeImageUpload:
        (uploadId, result) =>
        ({ tr, dispatch }) => {
          const hit = findUploadingImage(tr.doc, uploadId);
          if (!hit) return false;
          if (dispatch) {
            tr.setNodeMarkup(hit.pos, undefined, {
              ...hit.node.attrs,
              src: attachmentApiUrl(result.id),
              attachmentId: result.id,
              uploadId: null,
              width: result.width ?? hit.node.attrs.width,
              height: result.height ?? hit.node.attrs.height,
            });
            // 換網址不算一次「編輯」：⌘Z 不該退回 blob: 預覽。
            tr.setMeta("addToHistory", false);
          }
          return true;
        },

      failImageUpload:
        (uploadId) =>
        ({ tr, dispatch }) => {
          const hit = findUploadingImage(tr.doc, uploadId);
          if (!hit) return false;
          if (dispatch) {
            tr.delete(hit.pos, hit.pos + hit.node.nodeSize);
            tr.setMeta("addToHistory", false);
          }
          return true;
        },

      requestImagePick:
        () =>
        () => {
          const cb = this.options.onPickFiles;
          if (!cb) return false;
          cb();
          return true;
        },
    };
  },
});

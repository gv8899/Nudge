"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { createEditorExtensions } from "@/components/editor/editor-extensions";
import { useSlashCommandItems } from "@/components/editor/slash-command-items";
import { useBlockDrag } from "@/components/editor/use-block-drag";
import { BlockDragHandle, BlockDropIndicator } from "@/components/editor/block-drag-handle";
import { useImageUpload } from "@/components/editor/use-image-upload";
import {
  handleFileDrop,
  handleFilePaste,
  handlePickedFiles,
  type EntryPointSink,
} from "@/components/editor/image-entry-points";
import type { ImageUploadErrorCode } from "@/lib/image-upload";

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  editable?: boolean;
  /** 有給才啟用圖片（拖檔 / 貼上 / `/` 圖片）；上傳綁到這張卡片。 */
  attachmentTaskId?: string;
}

export const TiptapEditor = forwardRef<{ focus: () => void }, TiptapEditorProps>(
  function TiptapEditor(
    { content, onChange, onBlur, placeholder = "", autoFocus = false, editable = true, attachmentTaskId },
    ref,
  ) {
    const t = useTranslations("editor");
    const slashItems = useSlashCommandItems();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadError, setUploadError] = useState<ImageUploadErrorCode | null>(null);
    // editorProps / extensions 在 useEditor 建立時就固定，handler 透過 ref 拿到最新的 uploadFiles。

    const sinkRef = useRef<EntryPointSink>({ uploadFiles: () => {}, onRejected: () => {} });

    const editor = useEditor({
      immediatelyRender: false,
      // eslint-disable-next-line react-hooks/refs -- ref 只在使用者點擊 `/` 圖片時才讀，不在 render 期間
      extensions: createEditorExtensions({
        placeholder,
        slashItems,
        image: attachmentTaskId ? { onPickFiles: () => fileInputRef.current?.click() } : undefined,
      }),
      content,
      editable,
      autofocus: autoFocus ? "end" : false,
      onUpdate: ({ editor }) => onChange(editor.getHTML()),
      onBlur: () => onBlur?.(),
      editorProps: {
        attributes: { class: "outline-none min-h-[50vh]" },
        // 拖檔：只接「外部檔案」，把手的區塊拖曳（無 Files type）照舊交給 useBlockDrag。
        handleDrop: (view, event) => (attachmentTaskId ? handleFileDrop(view, event, sinkRef.current) : false),
        handlePaste: (view, event) => (attachmentTaskId ? handleFilePaste(view, event, sinkRef.current) : false),
      },
    });

    const showError = useCallback((code: ImageUploadErrorCode) => setUploadError(code), []);

    // 上傳中關分頁 / 重新整理 → JS 直接死掉，伺服器端補寫也跑不到；有上傳中的圖就讓
    // 瀏覽器跳「確定離開？」。（SPA 內關卡片不會觸發，那條路由 use-image-upload 補寫。）
    const pendingUploadsRef = useRef(0);
    const beforeUnloadRef = useRef<((e: BeforeUnloadEvent) => void) | null>(null);
    const handlePendingChange = useCallback((delta: 1 | -1) => {
      pendingUploadsRef.current = Math.max(0, pendingUploadsRef.current + delta);
      if (pendingUploadsRef.current > 0 && !beforeUnloadRef.current) {
        const handler = (e: BeforeUnloadEvent) => {
          e.preventDefault();
          e.returnValue = "";
        };
        beforeUnloadRef.current = handler;
        window.addEventListener("beforeunload", handler);
      } else if (pendingUploadsRef.current === 0 && beforeUnloadRef.current) {
        window.removeEventListener("beforeunload", beforeUnloadRef.current);
        beforeUnloadRef.current = null;
      }
    }, []);
    useEffect(
      () => () => {
        if (beforeUnloadRef.current) {
          window.removeEventListener("beforeunload", beforeUnloadRef.current);
          beforeUnloadRef.current = null;
        }
      },
      [],
    );

    const uploadFiles = useImageUpload(editor, attachmentTaskId, showError, handlePendingChange);
    useEffect(() => {
      sinkRef.current = {
        uploadFiles: (files, pos) => void uploadFiles(files, pos),
        onRejected: () => showError("imageUnsupported"),
      };
    }, [showError, uploadFiles]);

    useEffect(() => {
      if (!uploadError) return;
      const id = setTimeout(() => setUploadError(null), 4000);
      return () => clearTimeout(id);
    }, [uploadError]);

    const { containerRef, hoveredBlock, dropIndicatorTop, containerProps, handleDragStart, handleDragEnd } =
      useBlockDrag(editor);

    useImperativeHandle(ref, () => ({ focus: () => editor?.commands.focus("end") }));

    // 不從 prop 同步回編輯器 — editor 是 source of truth；換資料由 parent 用 key remount。
    useEffect(() => {
      if (editor) editor.setEditable(editable);
    }, [editor, editable]);

    return (
      <div ref={containerRef} {...containerProps} className="tiptap-container h-full relative md:pl-6 md:-ml-6">
        {uploadError && (
          <div
            role="alert"
            className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 bg-destructive/10 text-sm text-foreground"
          >
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
            {t(uploadError)}
          </div>
        )}
        {hoveredBlock && (
          <BlockDragHandle hoveredBlock={hoveredBlock} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
        )}
        {dropIndicatorTop !== null && <BlockDropIndicator top={dropIndicatorTop} />}
        <EditorContent editor={editor} className="h-full" />
        {attachmentTaskId && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              if (editor) handlePickedFiles(editor.view, e.target.files, sinkRef.current);
              e.target.value = "";
            }}
          />
        )}
      </div>
    );
  },
);

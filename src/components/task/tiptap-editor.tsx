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
import { isFileDrag, splitImageFiles } from "@/components/editor/file-drag";
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

    const showErrorRef = useRef<(code: ImageUploadErrorCode) => void>(() => {});
    const uploadFilesRef = useRef<(files: File[], pos?: number) => Promise<void>>(async () => {});

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
        handleDrop: (view, event) => {
          if (!attachmentTaskId || !isFileDrag(event.dataTransfer?.types)) return false;
          // 外部檔案一律攔下，避免瀏覽器把分頁導向該檔案。
          event.preventDefault();
          const { images: files, rejected } = splitImageFiles(event.dataTransfer?.files);
          if (rejected.length > 0) showErrorRef.current("imageUnsupported");
          if (files.length === 0) return true;
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          const pos = coords ? afterTopLevelBlock(view.state.doc, coords.pos) : view.state.doc.content.size;
          void uploadFilesRef.current(files, pos);
          return true;
        },
        handlePaste: (view, event) => {
          if (!attachmentTaskId) return false;
          // 有文字（Excel / Word 等會同時附 PNG 轉譯）→ 交給 ProseMirror 貼文字。
          if (event.clipboardData?.getData("text/plain")) return false;
          const { images: files, rejected } = splitImageFiles(event.clipboardData?.files);
          if (files.length === 0 && rejected.length === 0) return false;
          event.preventDefault();
          if (rejected.length > 0) showErrorRef.current("imageUnsupported");
          if (files.length === 0) return true;
          const pos = afterTopLevelBlock(view.state.doc, view.state.selection.to);
          void uploadFilesRef.current(files, pos);
          return true;
        },
      },
    });

    const showError = useCallback((code: ImageUploadErrorCode) => setUploadError(code), []);
    const uploadFiles = useImageUpload(editor, attachmentTaskId, showError);
    useEffect(() => {
      showErrorRef.current = showError;
      uploadFilesRef.current = uploadFiles;
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
              const { images: files, rejected } = splitImageFiles(e.target.files);
              e.target.value = "";
              if (rejected.length > 0) showError("imageUnsupported");
              if (!editor || files.length === 0) return;
              const pos = afterTopLevelBlock(editor.state.doc, editor.state.selection.to);
              void uploadFiles(files, pos);
            }}
          />
        )}
      </div>
    );
  },
);

/** 把任意 doc 位置換算成「所在頂層區塊之後」的插入點（圖片永遠是頂層區塊）。 */
function afterTopLevelBlock(doc: import("@tiptap/pm/model").Node, pos: number): number {
  const $pos = doc.resolve(Math.min(pos, doc.content.size));
  return $pos.depth === 0 ? $pos.pos : $pos.after(1);
}

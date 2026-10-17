"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

/**
 * 卡片圖片區塊。上傳中：blob 預覽 + 半透明遮罩 + 轉圈；完成：正式網址。
 * 選取時主色外框；Backspace / Delete 交給 ProseMirror 預設（NodeSelection）。
 */
export function AttachmentImageNodeView({ node, selected }: NodeViewProps) {
  const t = useTranslations("editor");
  const uploading = Boolean(node.attrs.uploadId);
  const { src, width, height, alt } = node.attrs as {
    src: string | null;
    width: number | null;
    height: number | null;
    alt: string | null;
  };

  return (
    <NodeViewWrapper
      className={`nudge-image-block relative my-3 ${selected ? "is-selected" : ""}`}
      data-uploading={uploading ? "true" : undefined}
      aria-label={uploading ? t("imageUploadingAria") : selected ? t("imageSelectedAria") : undefined}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          width={width ?? undefined}
          height={height ?? undefined}
          alt={alt ?? ""}
          draggable={false}
          className="block max-w-full h-auto rounded-md"
        />
      )}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60">
          <Loader2 className="h-6 w-6 animate-spin text-text-dim" aria-hidden="true" />
        </div>
      )}
    </NodeViewWrapper>
  );
}

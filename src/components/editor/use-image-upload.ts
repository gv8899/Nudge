"use client";

import { useCallback } from "react";
import type { Editor } from "@tiptap/core";
import { nanoid } from "nanoid";
import {
  ImageUploadError,
  prepareImageForUpload,
  uploadAttachment,
  type ImageUploadErrorCode,
} from "@/lib/image-upload";

/**
 * 三個入口共用：對每個檔案 → 立刻插「上傳中」節點（blob 預覽）→ 縮圖 → POST
 * → finalize（換成 /api/attachments/<id>）；任一步失敗 → 移除那一格 + onError。
 * 多檔依序插在同一個位置之後（每張 nodeSize = 1，所以 pos 每次 +1）。
 */
export function useImageUpload(
  editor: Editor | null,
  taskId: string | undefined,
  onError: (code: ImageUploadErrorCode) => void,
) {
  return useCallback(
    async (files: File[], pos?: number) => {
      if (!editor || !taskId || files.length === 0) return;
      let nextPos = pos;

      const jobs = files.map((file) => {
        const uploadId = nanoid();
        const previewSrc = URL.createObjectURL(file);
        const inserted = editor.commands.insertUploadingImage({ uploadId, previewSrc }, nextPos);
        if (nextPos !== undefined && inserted) nextPos += 1;
        return { file, uploadId, previewSrc };
      });

      await Promise.all(
        jobs.map(async ({ file, uploadId, previewSrc }) => {
          try {
            const prepared = await prepareImageForUpload(file);
            const result = await uploadAttachment(taskId, prepared);
            editor.commands.finalizeImageUpload(uploadId, result);
          } catch (e) {
            editor.commands.failImageUpload(uploadId);
            onError(e instanceof ImageUploadError ? e.code : "imageUploadFailed");
          } finally {
            URL.revokeObjectURL(previewSrc);
          }
        }),
      );
    },
    [editor, taskId, onError],
  );
}

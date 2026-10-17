"use client";

import { useCallback } from "react";
import type { Editor } from "@tiptap/core";
import { nanoid } from "nanoid";
import { mutate as globalMutate } from "swr";
import {
  ImageUploadError,
  prepareImageForUpload,
  uploadAttachment,
  type ImageUploadErrorCode,
} from "@/lib/image-upload";
import { patchCardField, seedCardVersion } from "@/lib/card-version";
import { replacePendingImage } from "./attachment-url";

type UploadResult = { id: string; width: number | null; height: number | null };

/** editor 可能已 destroy（卡片在上傳途中被關掉），commands 碰 view 會丟錯；一律吞掉當 false。 */
function safeCommand(editor: Editor, run: () => boolean): boolean {
  if (editor.isDestroyed) return false;
  try {
    return run();
  } catch {
    return false;
  }
}

/**
 * 卡片關掉後上傳才完成：編輯器已不在，但 autosave（unmount flush）可能已把
 * `<img data-upload-pending data-upload-id=…>` 存進 DB。到伺服器把那格補寫成最終
 * tag。placeholder 已不在（之後的存檔把它丟了）→ 什麼都不做；409 → 放棄（server 贏，
 * 同既有 silent use-latest 政策）。
 */
async function recoverIntoSavedDescription(taskId: string, uploadId: string, result: UploadResult) {
  try {
    const res = await fetch(`/api/tasks/${taskId}`);
    if (!res.ok) return;
    const task = (await res.json()) as { description?: string | null; updatedAt?: string | null };
    if (!task.description) return;
    const next = replacePendingImage(task.description, uploadId, result);
    if (next === null) return;
    seedCardVersion(taskId, task.updatedAt);
    const patched = await patchCardField(taskId, { description: next });
    if (patched.status !== "ok" || !patched.task) return;
    void globalMutate(
      (key) => typeof key === "string" && key.startsWith("/api/cards"),
      undefined,
      { revalidate: true },
    );
    void globalMutate(`/api/tasks/${taskId}`);
  } catch {
    // 補寫是盡力而為；失敗就留給孤兒清理。
  }
}

/**
 * 三個入口共用：對每個檔案 → 立刻插「上傳中」節點（blob 預覽）→ 縮圖 → POST
 * → finalize（換成 /api/attachments/<id>）；任一步失敗 → 移除那一格 + onError。
 * 多檔依序插在同一個位置之後（每張 nodeSize = 1，所以 pos 每次 +1）。
 * 卡片在上傳途中被關掉 → 走伺服器端補寫（recoverIntoSavedDescription）。
 * `onPendingChange(+1 / -1)`：每張開始 / 結束時通知（給 beforeunload 防呆）。
 */
export function useImageUpload(
  editor: Editor | null,
  taskId: string | undefined,
  onError: (code: ImageUploadErrorCode) => void,
  onPendingChange?: (delta: 1 | -1) => void,
) {
  return useCallback(
    async (files: File[], pos?: number) => {
      if (!editor || !taskId || files.length === 0) return;
      let nextPos = pos;

      const jobs = files.map((file) => {
        const uploadId = nanoid();
        const previewSrc = URL.createObjectURL(file);
        const inserted = safeCommand(editor, () =>
          editor.commands.insertUploadingImage({ uploadId, previewSrc }, nextPos),
        );
        if (nextPos !== undefined && inserted) nextPos += 1;
        onPendingChange?.(1);
        return { file, uploadId, previewSrc };
      });

      await Promise.all(
        jobs.map(async ({ file, uploadId, previewSrc }) => {
          try {
            const prepared = await prepareImageForUpload(file);
            const result = await uploadAttachment(taskId, prepared);
            const finalized = safeCommand(editor, () =>
              editor.commands.finalizeImageUpload(uploadId, result),
            );
            if (!finalized) await recoverIntoSavedDescription(taskId, uploadId, result);
          } catch (e) {
            safeCommand(editor, () => editor.commands.failImageUpload(uploadId));
            onError(e instanceof ImageUploadError ? e.code : "imageUploadFailed");
          } finally {
            URL.revokeObjectURL(previewSrc);
            onPendingChange?.(-1);
          }
        }),
      );
    },
    [editor, taskId, onError, onPendingChange],
  );
}

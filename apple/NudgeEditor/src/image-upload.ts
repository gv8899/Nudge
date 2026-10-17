// apple/NudgeEditor/src/image-upload.ts
//
// Apple bundle 的上傳佇列。行為對齊 Web `useImageUpload`
// （src/components/editor/use-image-upload.ts），差別在網路那一段交給 Swift：
// 每張圖立刻插「上傳中」placeholder → prepare（縮圖）→ base64 → post
// `{kind:"upload"}` 給 native → Swift 上傳完呼叫 `NudgeEditor.uploadResult`
// → finalize / fail。requestId 就是 placeholder 的 uploadId（Swift 在卡片關掉時
// 靠它到伺服器端補寫 `data-upload-id` 那格）。
import type { Editor } from "@tiptap/core";
import { ImageUploadError } from "@web-editor/image-prepare";
import type { UploadResultPayload } from "./bridge";

export interface UploadMessage {
  kind: "upload";
  requestId: string;
  taskId: string;
  mime: string;
  base64: string;
  width: number;
  height: number;
}

export interface UploaderDeps {
  editor: Editor;
  getTaskId(): string | null;
  post(msg: UploadMessage): void;
  prepare(file: File): Promise<{ blob: Blob; mime: string; width: number; height: number }>;
  onError(code: string): void;
  /** 預設 crypto.randomUUID()。 */
  newId?(): string;
}

export interface Uploader {
  uploadFiles(files: File[], pos: number): Promise<void>;
  /** 一律回真 boolean：true = placeholder 已處理；false = 不在了（或未知 requestId）。 */
  uploadResult(r: UploadResultPayload): boolean;
  pendingCount(): number;
}

/** editor 可能已 destroy，commands 碰 view 會丟錯；一律吞掉當 false。 */
function safeCommand(editor: Editor, run: () => boolean): boolean {
  if (editor.isDestroyed) return false;
  try {
    return Boolean(run());
  } catch {
    return false;
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

export function createUploader(deps: UploaderDeps): Uploader {
  const { editor } = deps;
  const newId = deps.newId ?? (() => crypto.randomUUID());
  // requestId → blob 預覽網址（finalize / fail 後 revoke）
  const pending = new Map<string, string>();

  function settle(requestId: string) {
    const preview = pending.get(requestId);
    pending.delete(requestId);
    if (preview) {
      try {
        URL.revokeObjectURL(preview);
      } catch {
        // ignore
      }
    }
  }

  function fail(requestId: string, code: string): boolean {
    const removed = safeCommand(editor, () => editor.commands.failImageUpload(requestId));
    settle(requestId);
    deps.onError(code);
    return removed;
  }

  return {
    async uploadFiles(files, pos) {
      const taskId = deps.getTaskId();
      if (!taskId || files.length === 0) return;
      let nextPos = pos;

      const jobs = files.map((file) => {
        const requestId = newId();
        const previewSrc = URL.createObjectURL(file);
        const inserted = safeCommand(editor, () =>
          editor.commands.insertUploadingImage({ uploadId: requestId, previewSrc }, nextPos),
        );
        // 每張 image nodeSize = 1（atom），下一張插在後面。
        if (inserted) nextPos += 1;
        pending.set(requestId, previewSrc);
        return { file, requestId };
      });

      await Promise.all(
        jobs.map(async ({ file, requestId }) => {
          try {
            const prepared = await deps.prepare(file);
            const base64 = await blobToBase64(prepared.blob);
            // placeholder 在縮圖期間可能已被使用者刪掉 —— 照樣送：
            // uploadResult 會回 false，由 Swift 決定要不要補寫。
            deps.post({
              kind: "upload",
              requestId,
              taskId,
              mime: prepared.mime,
              base64,
              width: prepared.width,
              height: prepared.height,
            });
          } catch (e) {
            fail(requestId, e instanceof ImageUploadError ? e.code : "imageUploadFailed");
          }
        }),
      );
    },

    uploadResult(r) {
      if (!r || typeof r.requestId !== "string" || !pending.has(r.requestId)) return false;
      if (r.ok) {
        const done = safeCommand(editor, () =>
          editor.commands.finalizeImageUpload(r.requestId, {
            id: r.id,
            width: r.width ?? null,
            height: r.height ?? null,
          }),
        );
        settle(r.requestId);
        return Boolean(done);
      }
      return Boolean(fail(r.requestId, r.error || "imageUploadFailed"));
    },

    pendingCount() {
      return pending.size;
    },
  };
}

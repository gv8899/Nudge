import { ALLOWED_IMAGE_MIMES, MAX_ATTACHMENT_BYTES, MAX_IMAGE_EDGE } from "../../lib/attachments/constants";

export type ImageUploadErrorCode = "imageTooLarge" | "imageUnsupported" | "imageUploadFailed";

export class ImageUploadError extends Error {
  constructor(public code: ImageUploadErrorCode) {
    super(code);
  }
}

export function isSupportedImageFile(file: { type: string }): boolean {
  return (ALLOWED_IMAGE_MIMES as readonly string[]).includes(file.type);
}

export function computeResizeTarget(
  w: number,
  h: number,
  maxEdge: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / Math.max(w, h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * 上傳前瘦身：最長邊 ≤ 2048，輸出 WebP 0.85（瀏覽器不支援 WebP 編碼就 JPEG）。
 * GIF 原樣送（保留動畫）。回傳的 width/height 是最終尺寸。
 */
export async function prepareImageForUpload(
  file: File,
): Promise<{ blob: Blob; mime: string; width: number; height: number }> {
  if (!isSupportedImageFile(file)) throw new ImageUploadError("imageUnsupported");

  const bitmap = await createImageBitmap(file);
  try {
    if (file.type === "image/gif") {
      if (file.size > MAX_ATTACHMENT_BYTES) throw new ImageUploadError("imageTooLarge");
      return { blob: file, mime: file.type, width: bitmap.width, height: bitmap.height };
    }

    const { width, height } = computeResizeTarget(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageUploadError("imageUploadFailed");
    ctx.drawImage(bitmap, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, "image/webp", 0.85);
    // Safari 舊版 toBlob('image/webp') 會回 PNG；型別不對就改 JPEG。
    if (!blob || blob.type !== "image/webp") {
      blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
    }
    if (!blob) throw new ImageUploadError("imageUploadFailed");
    if (blob.size > MAX_ATTACHMENT_BYTES) throw new ImageUploadError("imageTooLarge");
    return { blob, mime: blob.type, width, height };
  } finally {
    bitmap.close();
  }
}

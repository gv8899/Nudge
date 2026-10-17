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

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export type UploadEncoding = "image/webp" | "image/png" | "image/jpeg";

/**
 * 編碼決策（純函式，方便測）：
 * - canvas 能編 WebP → WebP。
 * - 不能（舊 Safari / 部分 WebKit 的 toBlob('image/webp') 會退成 PNG）：
 *   PNG 來源且無損 PNG 不超過上限 → PNG（保留透明度）；
 *   否則 JPEG（呼叫端先鋪白底，避免透明區變黑）。
 * `pngSize` = 已試編 PNG 的大小；沒試（非 PNG 來源 / 編碼失敗）傳 null。
 */
export function pickEncoding(
  sourceType: string,
  webpSupported: boolean,
  pngSize: number | null,
  maxBytes: number = MAX_ATTACHMENT_BYTES,
): UploadEncoding {
  if (webpSupported) return "image/webp";
  if (sourceType === "image/png" && pngSize != null && pngSize <= maxBytes) return "image/png";
  return "image/jpeg";
}

/**
 * 上傳前瘦身：最長邊 ≤ 2048，輸出 WebP 0.85；不支援 WebP 編碼時見 pickEncoding
 * （PNG 保透明 → 否則白底 JPEG 0.85）。GIF 原樣送（保留動畫）。
 * 回傳的 width/height 是最終尺寸。
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

    const webp = await canvasToBlob(canvas, "image/webp", 0.85);
    const webpSupported = !!webp && webp.type === "image/webp";
    let png: Blob | null = null;
    if (!webpSupported && file.type === "image/png") {
      png = await canvasToBlob(canvas, "image/png");
      if (png && png.type !== "image/png") png = null;
    }

    let blob: Blob | null = null;
    switch (pickEncoding(file.type, webpSupported, png?.size ?? null)) {
      case "image/webp":
        blob = webp;
        break;
      case "image/png":
        blob = png;
        break;
      case "image/jpeg":
        // JPEG 沒有 alpha：透明區會變黑 → 先鋪白底再重畫。
        ctx.fillStyle = "#fff"; // not a UI colour — 圖片資料的背景
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(bitmap, 0, 0, width, height);
        blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
        break;
    }
    if (!blob) throw new ImageUploadError("imageUploadFailed");
    if (blob.size > MAX_ATTACHMENT_BYTES) throw new ImageUploadError("imageTooLarge");
    return { blob, mime: blob.type, width, height };
  } finally {
    bitmap.close();
  }
}

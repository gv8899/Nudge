export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

/** 伺服器硬上限：單張附件 5MB（客戶端縮圖後正常只有幾百 KB）。 */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
/** 卡片 description HTML 上限 1MB（防呆，不是功能）。 */
export const MAX_DESCRIPTION_BYTES = 1024 * 1024;
/** 客戶端縮圖：最長邊。 */
export const MAX_IMAGE_EDGE = 2048;

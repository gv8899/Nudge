import type { AllowedImageMime } from "./constants";

/**
 * 用檔頭 magic bytes 判斷圖片格式。不信任 Content-Type / 副檔名。
 * 只認 jpeg / png / gif / webp；其他（含 SVG）一律 null。
 */
export function sniffImageMime(bytes: Uint8Array): AllowedImageMime | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  const head6 = String.fromCharCode(...bytes.subarray(0, 6));
  if (head6 === "GIF87a" || head6 === "GIF89a") return "image/gif";
  const riff = String.fromCharCode(...bytes.subarray(0, 4));
  const webp = String.fromCharCode(...bytes.subarray(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}

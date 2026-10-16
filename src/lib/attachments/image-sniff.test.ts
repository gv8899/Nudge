import { describe, it, expect } from "vitest";
import { sniffImageMime } from "./image-sniff";

const bytes = (...xs: number[]) => new Uint8Array(xs);
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

describe("sniffImageMime", () => {
  it("JPEG：FF D8 FF", () => {
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0))).toBe("image/jpeg");
  });
  it("PNG：89 PNG\\r\\n 1A \\n", () => {
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0))).toBe("image/png");
  });
  it("GIF87a / GIF89a", () => {
    expect(sniffImageMime(bytes(...ascii("GIF89a"), 0, 0, 0, 0, 0, 0))).toBe("image/gif");
    expect(sniffImageMime(bytes(...ascii("GIF87a"), 0, 0, 0, 0, 0, 0))).toBe("image/gif");
  });
  it("WebP：RIFF....WEBP", () => {
    expect(sniffImageMime(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP")))).toBe("image/webp");
  });
  it("RIFF 但不是 WEBP（例如 WAV）→ null", () => {
    expect(sniffImageMime(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")))).toBeNull();
  });
  it("SVG / 文字 / 太短 → null", () => {
    expect(sniffImageMime(bytes(...ascii("<svg xmlns=\"http://www.w3.org/2000/svg\">")))).toBeNull();
    expect(sniffImageMime(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImageMime(new Uint8Array(0))).toBeNull();
  });
});

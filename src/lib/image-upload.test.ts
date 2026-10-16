import { describe, it, expect } from "vitest";
import { isSupportedImageFile, computeResizeTarget } from "./image-upload";

describe("isSupportedImageFile", () => {
  it("四種格式 true，其他 false", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(isSupportedImageFile({ type: t })).toBe(true);
    }
    expect(isSupportedImageFile({ type: "image/svg+xml" })).toBe(false);
    expect(isSupportedImageFile({ type: "image/heic" })).toBe(false);
    expect(isSupportedImageFile({ type: "application/pdf" })).toBe(false);
    expect(isSupportedImageFile({ type: "" })).toBe(false);
  });
});

describe("computeResizeTarget", () => {
  it("小於上限不動", () => {
    expect(computeResizeTarget(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("橫圖以寬為準等比縮", () => {
    expect(computeResizeTarget(4096, 3072)).toEqual({ width: 2048, height: 1536 });
  });
  it("直圖以高為準等比縮", () => {
    expect(computeResizeTarget(1500, 6000)).toEqual({ width: 512, height: 2048 });
  });
  it("四捨五入後至少 1px", () => {
    expect(computeResizeTarget(10000, 1)).toEqual({ width: 2048, height: 1 });
  });
  it("可指定上限", () => {
    expect(computeResizeTarget(1000, 500, 100)).toEqual({ width: 100, height: 50 });
  });
});

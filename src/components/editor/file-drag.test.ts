import { describe, it, expect } from "vitest";
import { isFileDrag, pickImageFiles, splitImageFiles } from "./file-drag";

describe("isFileDrag", () => {
  it("types 含 Files → true", () => {
    expect(isFileDrag(["Files"])).toBe(true);
    expect(isFileDrag(["text/plain", "Files"])).toBe(true);
  });
  it("內部區塊拖曳（無 Files）→ false", () => {
    expect(isFileDrag(["text/html"])).toBe(false);
    expect(isFileDrag([])).toBe(false);
    expect(isFileDrag(undefined)).toBe(false);
  });
});

describe("pickImageFiles", () => {
  const f = (type: string) => ({ type }) as File;
  it("只留支援的圖片、保留順序", () => {
    expect(pickImageFiles([f("image/png"), f("text/plain"), f("image/gif")]).map((x) => x.type))
      .toEqual(["image/png", "image/gif"]);
  });
  it("null → []", () => {
    expect(pickImageFiles(null)).toEqual([]);
  });
});

describe("splitImageFiles", () => {
  const f = (type: string) => ({ type }) as File;
  it("分出圖片與被拒絕的檔案", () => {
    const r = splitImageFiles([f("image/png"), f("application/pdf"), f("image/heic")]);
    expect(r.images.map((x) => x.type)).toEqual(["image/png"]);
    expect(r.rejected.map((x) => x.type)).toEqual(["application/pdf", "image/heic"]);
  });
  it("null → 都空", () => {
    expect(splitImageFiles(null)).toEqual({ images: [], rejected: [] });
  });
});

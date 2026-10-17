import { isSupportedImageFile } from "./image-prepare";

/** 這次 DnD 是不是「從外面拖檔案進來」（而不是把手的區塊拖曳）。 */
export function isFileDrag(types: readonly string[] | DOMStringList | undefined): boolean {
  if (!types) return false;
  return Array.from(types as ArrayLike<string>).includes("Files");
}

export function pickImageFiles(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list as ArrayLike<File>).filter(isSupportedImageFile);
}

/** 分成支援的圖片與被濾掉的檔案（用來回報 imageUnsupported）。 */
export function splitImageFiles(list: FileList | File[] | null | undefined): {
  images: File[];
  rejected: File[];
} {
  if (!list) return { images: [], rejected: [] };
  const all = Array.from(list as ArrayLike<File>);
  return {
    images: all.filter(isSupportedImageFile),
    rejected: all.filter((f) => !isSupportedImageFile(f)),
  };
}

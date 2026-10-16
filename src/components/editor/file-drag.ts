import { isSupportedImageFile } from "@/lib/image-upload";

/** 這次 DnD 是不是「從外面拖檔案進來」（而不是把手的區塊拖曳）。 */
export function isFileDrag(types: readonly string[] | DOMStringList | undefined): boolean {
  if (!types) return false;
  return Array.from(types as ArrayLike<string>).includes("Files");
}

export function pickImageFiles(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list as ArrayLike<File>).filter(isSupportedImageFile);
}

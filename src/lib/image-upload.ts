export {
  ImageUploadError,
  isSupportedImageFile,
  computeResizeTarget,
  pickEncoding,
  prepareImageForUpload,
  type ImageUploadErrorCode,
} from "@/components/editor/image-prepare";
import { ImageUploadError } from "@/components/editor/image-prepare";

export async function uploadAttachment(
  taskId: string,
  prepared: { blob: Blob; width: number; height: number },
): Promise<{ id: string; width: number | null; height: number | null }> {
  const form = new FormData();
  form.append("file", prepared.blob, "image");
  form.append("taskId", taskId);
  form.append("width", String(prepared.width));
  form.append("height", String(prepared.height));

  let res: Response;
  try {
    res = await fetch("/api/attachments", { method: "POST", body: form });
  } catch {
    throw new ImageUploadError("imageUploadFailed");
  }
  if (res.status === 413) throw new ImageUploadError("imageTooLarge");
  if (res.status === 400) throw new ImageUploadError("imageUnsupported");
  if (!res.ok) throw new ImageUploadError("imageUploadFailed");
  const json = (await res.json()) as { id: string; width: number | null; height: number | null };
  return { id: json.id, width: json.width ?? prepared.width, height: json.height ?? prepared.height };
}

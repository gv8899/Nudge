// 連接器「從網址把圖片存進卡片」用的安全下載。
// 下載的是任意外部網址，所以：只走 http(s)、每一跳轉址都重新檢查目標不是內網
// （擋 SSRF）、10 秒逾時、邊讀邊算大小（上限同手動上傳 5MB）、用檔頭判斷格式
// （不信任 Content-Type，SVG 一律不收）。

import { lookup } from "dns/promises";
import { isPrivateAddress } from "@/lib/oauth/core";
import { MAX_ATTACHMENT_BYTES, type AllowedImageMime } from "@/lib/attachments/constants";
import { sniffImageMime } from "@/lib/attachments/image-sniff";

export class ImageFetchError extends Error {}

const MAX_REDIRECTS = 3;

async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ImageFetchError("Not a valid URL.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new ImageFetchError("Only http(s) image URLs are supported.");
  }
  if (u.username || u.password) throw new ImageFetchError("URLs with credentials are not supported.");
  let addrs: { address: string }[];
  try {
    addrs = await lookup(u.hostname, { all: true });
  } catch {
    throw new ImageFetchError("Could not resolve the image host.");
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new ImageFetchError("That address is not allowed.");
  }
  return u;
}

async function readCapped(res: Response): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > MAX_ATTACHMENT_BYTES) throw new ImageFetchError("Image is larger than 5 MB.");
  if (!res.body) throw new ImageFetchError("Empty response.");
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ATTACHMENT_BYTES) {
      await reader.cancel();
      throw new ImageFetchError("Image is larger than 5 MB.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function fetchImage(
  rawUrl: string,
): Promise<{ bytes: Buffer; mime: AllowedImageMime; finalUrl: string }> {
  let url = await assertPublicUrl(rawUrl);
  const deadline = AbortSignal.timeout(10_000);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: deadline,
        headers: { accept: "image/*", "user-agent": "NudgeBot/1.0 (+https://nudge.tw)" },
      });
    } catch {
      throw new ImageFetchError("Could not download the image.");
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) throw new ImageFetchError("Broken redirect.");
      url = await assertPublicUrl(new URL(next, url).toString());
      continue;
    }
    if (!res.ok) throw new ImageFetchError(`The image URL returned HTTP ${res.status}.`);
    const bytes = await readCapped(res);
    const mime = sniffImageMime(new Uint8Array(bytes.subarray(0, 16)));
    if (!mime) {
      throw new ImageFetchError("That URL is not a JPEG, PNG, WebP or GIF image (web pages and SVG are not supported).");
    }
    return { bytes, mime, finalUrl: url.toString() };
  }
  throw new ImageFetchError("Too many redirects.");
}

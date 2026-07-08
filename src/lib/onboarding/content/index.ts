import type { OnboardingContent } from "./types";
import { zhTW } from "./zh-TW";
import { en } from "./en";
import { ja } from "./ja";

export type { OnboardingContent } from "./types";

const BY_LOCALE: Record<string, OnboardingContent> = {
  "zh-TW": zhTW,
  en,
  ja,
};

/**
 * 依 locale 取範例內容。未知 / null 一律 fallback 到 zh-TW（app 預設語言）。
 * 只取主語言標籤前綴（"en-US" → "en"）。
 */
export function contentForLocale(locale: string | null | undefined): OnboardingContent {
  if (!locale) return zhTW;
  if (BY_LOCALE[locale]) return BY_LOCALE[locale];
  const base = locale.split("-")[0];
  // en / ja 用前綴命中；zh 一律回 zh-TW。
  if (base === "en") return en;
  if (base === "ja") return ja;
  return zhTW;
}

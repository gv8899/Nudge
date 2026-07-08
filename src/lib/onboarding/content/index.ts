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
 * 依 locale 取範例內容。規則：中文（zh*）→ 繁中、日文（ja）→ 日文、
 * **其他一律英文**（英文是國際 fallback，含未知 / null）。
 * 只取主語言標籤前綴（"en-US" → "en"、"zh-Hant" → "zh"）。
 */
export function contentForLocale(locale: string | null | undefined): OnboardingContent {
  if (!locale) return en;
  if (BY_LOCALE[locale]) return BY_LOCALE[locale];
  const base = locale.split("-")[0];
  if (base === "zh") return zhTW; // 任何中文變體 → 繁中
  if (base === "ja") return ja;
  return en; // 其他一律英文
}

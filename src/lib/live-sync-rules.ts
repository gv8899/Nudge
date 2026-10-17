// 打開中的卡片收到同步事件要怎麼辦 —— 三平台共用的一條規則（Swift 鏡像：
// NudgeCore/RemoteChangeDecision.swift）。改這裡要一起改那邊 + 兩邊測試。
import type { SyncEvent } from "./sync-types";

export type RemoteDecision = "apply" | "ignore" | "list-only";

/** 與 server 409 判斷一致：秒精度比較。 */
export function sameSecond(a: string, b: string): boolean {
  return Math.floor(new Date(a).getTime() / 1000) === Math.floor(new Date(b).getTime() / 1000);
}

export function decideRemoteChange(args: {
  event: SyncEvent;
  cardId: string;
  baseUpdatedAt: string | null;
  hasPending: boolean;
}): RemoteDecision {
  const { event, cardId, baseUpdatedAt, hasPending } = args;
  if (event.kind !== "task" || event.id !== cardId) return "list-only";
  if (baseUpdatedAt) {
    if (sameSecond(event.updatedAt, baseUpdatedAt)) return "ignore";
    if (new Date(event.updatedAt).getTime() < new Date(baseUpdatedAt).getTime()) return "ignore";
  }
  // 本機有未存檔修改：不抓、不 seed、不重載 —— 等存檔被 409 擋再換最新。
  if (hasPending) return "ignore";
  return "apply";
}

export interface CardContent {
  title: string;
  description: string;
}

/**
 * 重抓回來後要不要重 mount 編輯器：比對的基準是「編輯器實際 mount 的內容」，
 * 不是 SWR cache（cache 可能已被其他重抓更新、編輯器卻還是舊內容）。
 */
export function shouldRemountAfterFetch(args: {
  mounted: CardContent;
  latest: CardContent | undefined;
  stillIdle: boolean;
}): boolean {
  const { mounted, latest, stillIdle } = args;
  if (!latest || !stillIdle) return false;
  return latest.title !== mounted.title || latest.description !== mounted.description;
}

/** 與編輯器 `content={description || ""}` 同一個正規化。 */
export function cardContentOf(card: { title: string; description: string | null }): CardContent {
  return { title: card.title, description: card.description || "" };
}

export type DataChangeDecision = "seed-first" | "skip" | "remount-and-seed" | "seed";

/**
 * 卡片資料（SWR data）變動時的處置。不變式：**版本基準只在編輯器顯示該版本時推進**
 * —— TiptapEditor 不會重讀 content prop，所以 idle 時的 data 變動若內容不同必須重 mount，
 * 否則基準推進、編輯器仍是舊內容，下一次存檔就以舊內容通過版本檢查、覆蓋遠端。
 * - first：這張卡第一次拿到資料（編輯器正以這份 data mount）→ 記下內容並 seed。
 * - pending：本機有未存 / 在途修改 → 不 seed、不重 mount，交給存檔的 409 路徑。
 * - 內容與掛載的不同 → 重 mount 並 seed；相同 → 只 seed。
 */
export function decideOnDataChange(args: {
  first: boolean;
  pending: boolean;
  mounted: CardContent;
  latest: CardContent;
}): DataChangeDecision {
  const { first, pending, mounted, latest } = args;
  if (pending) return "skip";
  if (first) return "seed-first";
  return shouldRemountAfterFetch({ mounted, latest, stillIdle: true }) ? "remount-and-seed" : "seed";
}

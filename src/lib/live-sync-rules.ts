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

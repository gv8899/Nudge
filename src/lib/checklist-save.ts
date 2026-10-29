// 任務列上勾 / 新增子項目的存檔 —— 把 checklist 改動寫回 tasks.description，
// 走既有的樂觀並行 PATCH（card-version.ts）。跟詳情編輯器共用同一條存檔路徑與
// 基準版本，所以兩邊同時開同一任務也不會互蓋。
//
// 衝突處理：被別台改新 → server 回 409 + 最新內文。用最新內文重套一次同一筆
// 改動（toggle 以文字比對第 index 項，對得上才套）：成功就再存一次；重套回 null
// （文字已被改掉、對不上）就放棄，回 dropped 讓呼叫端重載。只重試一次。

import { applyChecklistEdit, type ChecklistEdit } from "./checklist";
import { getCardVersion, patchCardField, seedCardVersion } from "./card-version";

export type ChecklistSaveResult =
  | { status: "saved"; description: string; updatedAt: string }
  | { status: "dropped"; latestDescription: string | null };

function latestDescription(latest: Record<string, unknown>): string | null {
  return typeof latest.description === "string" ? latest.description : null;
}

function updatedAtOf(task: Record<string, unknown> | null, fallback: string): string {
  return task && typeof task.updatedAt === "string" ? task.updatedAt : fallback;
}

export async function saveChecklistEdit(
  task: { id: string; description: string | null; updatedAt: string },
  edit: ChecklistEdit,
): Promise<ChecklistSaveResult | null> {
  // 只有尚無基準時才 seed —— 避免蓋掉詳情編輯器已記的（可能較新的）基準。
  if (getCardVersion(task.id) === null) {
    seedCardVersion(task.id, task.updatedAt);
  }

  const next = applyChecklistEdit(task.description, edit);
  if (next === null) return null; // 本地套用失敗（例如 toggle 文字不符），什麼都不送

  const res = await patchCardField(task.id, { description: next });
  if (res.status === "ok") {
    return { status: "saved", description: next, updatedAt: updatedAtOf(res.task, task.updatedAt) };
  }

  // 409：拿 server 最新內文重套一次。
  const latest = latestDescription(res.latest);
  const rebased = applyChecklistEdit(latest, edit);
  if (rebased === null) {
    return { status: "dropped", latestDescription: latest };
  }

  const res2 = await patchCardField(task.id, { description: rebased });
  if (res2.status === "ok") {
    return { status: "saved", description: rebased, updatedAt: updatedAtOf(res2.task, task.updatedAt) };
  }

  // 再次衝突：不再重試，交回最新內文讓呼叫端重載。
  return { status: "dropped", latestDescription: latestDescription(res2.latest) };
}

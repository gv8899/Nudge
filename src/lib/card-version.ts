// 卡片內容（title/description）存檔的「樂觀並行」基準版本追蹤 + PATCH 封裝。
//
// 跨裝置同時編輯同一張卡時，停在舊版本的裝置存檔會被 server 回 409（見
// src/app/api/tasks/[id]/route.ts）。這裡集中記「某張卡目前畫面內容基於哪個
// updatedAt」，存檔時送給 server 比對：被別台改新就回 409 + 最新版，呼叫端
// 靜默改用最新（方案二 silent use-latest）。基準在每次成功存檔後推進，所以
// 自己連續存不會誤判成衝突。對應原生的 CardVersionStore。

const baseByCardId = new Map<string, string>();

/** 編輯器顯示某張卡時呼叫 —— 記錄「目前畫面內容所基於的版本」。 */
export function seedCardVersion(id: string, updatedAt?: string | null) {
  if (updatedAt) baseByCardId.set(id, updatedAt);
}

export type CardPatchResult =
  | { status: "ok"; task: Record<string, unknown> | null }
  | { status: "conflict"; latest: Record<string, unknown> };

/**
 * PATCH /api/tasks/[id]，帶 baseUpdatedAt 樂觀並行。
 * - 200 → 推進基準，回 `{ status: "ok", task }`。
 * - 409 → 推進基準到 server 最新，回 `{ status: "conflict", latest }`（呼叫端
 *   負責採用最新 + 重載編輯器）。
 * - 其他非 2xx → 回 `{ status: "ok", task: null }`（沿用舊行為，不擋使用者）。
 */
export async function patchCardField(
  id: string,
  updates: { title?: string; description?: string }
): Promise<CardPatchResult> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...updates, baseUpdatedAt: baseByCardId.get(id) ?? null }),
  });

  if (res.status === 409) {
    const latest = (await res.json()) as Record<string, unknown>;
    if (typeof latest.updatedAt === "string") baseByCardId.set(id, latest.updatedAt);
    return { status: "conflict", latest };
  }

  if (res.ok) {
    const task = (await res.json()) as Record<string, unknown>;
    if (typeof task.updatedAt === "string") baseByCardId.set(id, task.updatedAt);
    return { status: "ok", task };
  }

  return { status: "ok", task: null };
}

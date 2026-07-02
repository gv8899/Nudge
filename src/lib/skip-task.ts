import { mutate as globalMutate } from "swr";

/**
 * 跳過某個 daily-assignment 的這次重複（isSkipped=true），立即執行、不再需要
 * 確認框（對齊 Mac：TaskRowMenu 點了就跳過）。存檔後 revalidate 當天 + 週檢視
 * 圓點的 SWR key，讓 row 立刻從清單消失、行事曆圓點同步更新。
 */
export async function skipOccurrence(
  assignmentId: string,
  currentDate: string
): Promise<void> {
  const res = await fetch(`/api/daily-assignments/${assignmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isSkipped: true }),
  });
  if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
  await globalMutate(`/api/daily/${currentDate}`);
  await globalMutate(
    (key) => typeof key === "string" && key.startsWith("/api/daily/week")
  );
}

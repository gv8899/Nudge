// 任務列 checklist 子項目的「收合」記憶 —— 每裝置各自存，localStorage。
// 值為收合中的 task id 陣列。所有讀寫包 try/catch：SSR / 無痕 / 被封鎖時
// 一律當作「未收合」（預設展開），不讓例外冒出。

const KEY = "nudge.checklistCollapsed";

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function write(ids: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // 寫不進去就算了，下次還是從展開開始。
  }
}

export function isChecklistCollapsed(taskId: string): boolean {
  return read().has(taskId);
}

export function setChecklistCollapsed(taskId: string, collapsed: boolean): void {
  const ids = read();
  if (collapsed) ids.add(taskId);
  else ids.delete(taskId);
  write(ids);
}

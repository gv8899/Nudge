// 去掉 API 回應裡 ISO 時間戳的小數秒（毫秒）。
//
// 為什麼：舊版 macOS app（build ≤121）的 APIClient 用裸 `.iso8601`
// JSONDecoder 解日期。在較舊的 macOS 上 `.iso8601` 走嚴格行為，**解不了
// 帶毫秒的時間戳**（`new Date().toISOString()` 產的 "2026-06-15T02:51:18.061Z"）
// → decode 回 nil → 整個 DTO decode 失敗 → app 顯示「發生錯誤」。
//
// 這是給「已出貨舊版」的 server 端相容處理：輸出不帶毫秒，嚴格 `.iso8601`
// 就解得動（"...18Z" OK）。app 端正解（custom date strategy 同時吃有/無
// 毫秒）見 APIClient 修法；那個上線後此 helper 可移除。

// 只匹配「完整的 ISO8601 帶毫秒」字串，避免誤傷一般含 '.' 的內容。
const ISO_WITH_MS =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.\d+(Z|[+-]\d{2}:\d{2})$/;

/**
 * 遞迴走訪任意 JSON 值，把所有「完整 ISO 帶毫秒」時間戳的小數秒去掉。
 * 其他字串、數字、null 原樣保留。
 */
export function stripFractionalSecondsDeep<T>(value: T): T {
  if (typeof value === "string") {
    const m = value.match(ISO_WITH_MS);
    return (m ? `${m[1]}${m[2]}` : value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => stripFractionalSecondsDeep(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = stripFractionalSecondsDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}

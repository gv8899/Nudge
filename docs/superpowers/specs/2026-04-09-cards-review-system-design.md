# 卡片回顧系統設計

## 摘要

讓有 description 的任務可以被獨立瀏覽、搜尋、回顧。**Card 不是新的 entity**，它就是「description 不為空」的 task 的另一個 view。目的：知識累積（A）+ 平常用搜尋找回過去的內容（D）。

## 設計決策

| 項目 | 決定 |
|------|------|
| Card 與 Task 關係 | 同一 entity；Card = `description != ''` 的 Task |
| 來源 | 全部有 description 的任務自動列入，無須手動標記 |
| 入口 | sidebar 新增 Cards icon（在 Settings 之上） |
| 瀏覽 | 列表頁 `/cards`，**list / grid 兩種 view 可切換**（持久化於 localStorage） |
| 點擊行為 | 進入獨立全螢幕頁面 `/cards/[id]` |
| 預設排序 | `updatedAt desc`（最近更新優先），不提供使用者切換 |
| 搜尋 | 全域搜尋框，搜尋標題 + description 內容（server-side LIKE） |
| 載入策略 | 無限捲動，每批 20 張 |
| 連結 / backlinks | **先不做**，未來考慮 |

## 路由

### `/cards` — 列表頁

#### 結構
```
┌──────────────────────────────────────┐
│ Cards                  [list][grid]  │  ← title + view toggle
│ ┌────────────────────────────────┐   │
│ │ 🔍 搜尋卡片...                  │  │  ← 搜尋框
│ └────────────────────────────────┘   │
│                                      │
│ [卡片內容 — list 或 grid]            │
│                                      │
│ ← 載入更多時自動觸發                  │
└──────────────────────────────────────┘
```

#### List view
單欄列表，每張卡片一行：
- 標題（粗體）
- description 預覽（純文字 strip HTML，最多 ~150 字元）
- 右上：updatedAt 簡寫日期（M/d）
- 右下：status badge

#### Grid view
2-3 欄響應式網格（mobile 1 欄、tablet 2 欄、desktop 3 欄）：
- 標題（粗體）
- description 預覽（純文字，~80 字元）
- 底部：日期 + status 同行

#### View toggle
- list / grid 兩個 icon button（lucide `List` / `LayoutGrid`）
- 狀態存於 `localStorage`，key `nudge:cards-view`，值 `"list"` / `"grid"`
- 預設 `list`

#### 空狀態
description 都為空時顯示「還沒有寫過內容的任務」+ 簡單提示。

#### 搜尋
- 輸入框 onChange debounce 300ms
- 觸發 API call，重置游標
- 空字串 = 顯示全部
- Server 端用 SQLite `LIKE '%q%'` 對 title 與 description 各做一次查詢

### `/cards/[id]` — 詳細頁

#### 結構
- 上方：「← 返回卡片」連結
- Header 區：標題（大字）、meta 列（建立日期、最後更新、狀態 badge）
- 內容區：完整 description 用 TipTap container 樣式 render（與既有 task detail modal 相同）
- 全寬版面 `max-w-3xl`（比 daily-view 的 max-w-2xl 略寬，因為內容是主角）
- 預留底部 backlinks 區位置（**不實作**，僅留 layout 註解）

#### 找不到時
- 不存在的 id 或非 owner → 404

## 後端

### 新 API：`GET /api/cards`

**Query params**
- `q?: string` — 搜尋字串
- `cursor?: string` — 分頁游標（前一批最後一筆的 `updatedAt`）
- `limit?: number` — 預設 20，上限 50

**Where 條件**
```sql
WHERE tasks.user_id = :userId
  AND tasks.description IS NOT NULL
  AND tasks.description != ''
  AND tasks.status != 'archived'
  -- 若有 q：
  AND (tasks.title LIKE '%' || :q || '%' OR tasks.description LIKE '%' || :q || '%')
  -- 若有 cursor：
  AND tasks.updated_at < :cursor
ORDER BY tasks.updated_at DESC
LIMIT :limit
```

**Response**
```ts
{
  cards: Array<{
    id: string;
    title: string;
    description: string;  // HTML
    status: TaskStatus;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
  }>;
  nextCursor: string | null;  // 最後一筆的 updatedAt，下一批用
}
```

### 詳細頁資料

reuse 既有 `GET /api/tasks/[id]`（如果存在）或新增 `GET /api/cards/[id]`。後者也要驗證 user ownership 且 description 不為空（避免直接導向沒內容的任務頁）。

## Sidebar 改動

`src/components/sidebar/app-sidebar.tsx` 的 `navItems` 加入：

```ts
{
  href: "/cards",
  match: "/cards",
  icon: BookOpen,  // lucide
  label: "Cards",
}
```

順序：Tasks → Notes → **Cards** → (底部) Settings。

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 新增 | `src/app/(app)/cards/page.tsx` | 列表頁（server component，掛 client 元件） |
| 新增 | `src/app/(app)/cards/[id]/page.tsx` | 詳細頁 |
| 新增 | `src/components/cards/cards-feed.tsx` | client 元件：搜尋、view 切換、無限捲動 |
| 新增 | `src/components/cards/card-list-item.tsx` | list view 單張卡片 |
| 新增 | `src/components/cards/card-grid-item.tsx` | grid view 單張卡片 |
| 新增 | `src/components/cards/card-detail.tsx` | 詳細頁 client 元件 |
| 新增 | `src/app/api/cards/route.ts` | GET 列表 API |
| 新增 | `src/app/api/cards/[id]/route.ts` | GET 單張卡片 |
| 新增 | `src/hooks/use-cards-feed.ts` | SWR 無限捲動 hook（仿 `use-notes-feed.ts`） |
| 新增 | `src/lib/strip-html.ts` | 簡單的 HTML → 純文字工具，給預覽用 |
| 修改 | `src/components/sidebar/app-sidebar.tsx` | 加入 Cards nav item |

## 描述預覽工具

`src/lib/strip-html.ts`：
- 用 regex 移除 HTML tag、`&nbsp;` 等 entity
- 壓縮多餘空白
- 不處理 XSS（只用於預覽顯示，不會 dangerouslySetInnerHTML）
- 接 `maxLength` 參數截斷

範例：
```ts
stripHtml("<p>Hello <strong>world</strong></p>", 50) // → "Hello world"
```

## 邊界情況

1. **description 是空白 HTML**（例如 `<p></p>` 或 `<p><br></p>`）：API 應該過濾掉，不算有內容
   - SQL `description != ''` 不夠，需要在查詢後 strip 預覽 → 如果 strip 後也空，後端再過濾
   - 或在前端 strip 結果 trim 後判斷是否顯示
2. **搜尋無結果**：顯示「沒有符合的卡片」
3. **點擊已 archived 的任務**：API 已過濾掉，不會出現在列表
4. **長標題 / 長預覽**：list 用 `truncate`、grid 用 `line-clamp-3`
5. **無限捲動觸發 race**：用既有的 `useIntersectionObserver` hook + cursor，避免重複載入
6. **mobile 響應式**：grid 在 mobile 自動降為 1 欄（同 list 但保留 grid 樣式）

## 不在範圍內（明確 defer）

- 卡片之間連結 / `[[wikilink]]` / backlinks
- Tag 系統 / 分類
- 排序選項暴露給使用者
- 多選、批次操作
- 全文搜尋（FTS5）— 先用 LIKE，量大再升級
- 卡片頁的內聯編輯（要編輯就回到 task detail modal）
- 收藏 / 釘選 / 重要度標記

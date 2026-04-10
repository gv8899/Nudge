# 卡片看板 View + Tag 系統設計

## 摘要

在 `/cards` 頁新增第三種 view「看板」，每個 tag 是一個 column，卡片依 tag 分到對應的 column。同時新增完整的 tag 系統（CRUD + 指派）。

## 設計決策

| 項目 | 決定 |
|------|------|
| Tag 適用範圍 | 所有 task 都能加 tag，但 UI 只在卡片系統顯示（日常行動頁不顯示） |
| 每張卡片 tag 數 | 多個。看板中同一張卡片可出現在多個 column |
| 看板拖移行為 | 替換 tag — 移除原 column 的 tag，加上目標 column 的 tag |
| 未分類卡片 | 不出現在看板（list/grid 仍看得到） |
| Tag 顏色 | 預設色盤，使用 design token |
| Tag 群組/樹狀 | 不做，預留 sortOrder 未來擴展 |
| Group by 二層分類 | 不做 |
| 看板內新增卡片 | 不做，用既有 + 按鈕建卡片再加 tag |

## Data Model

### tags 表（已存在，需修改）

```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'chart-1',  -- 改為存 token 名稱，不存 hex
  sort_order INTEGER NOT NULL DEFAULT 0   -- 新增
);
```

變更：
- `color` 預設值從 `#6b7280` 改為 `chart-1`（design token 名稱）
- 新增 `sort_order` 欄位（控制看板 column 順序）

### task_tags 表（已存在，不修改）

```sql
CREATE TABLE task_tags (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE
);
```

### Drizzle schema 對應修改

`src/lib/db/schema.ts` 的 tags 表加 `sortOrder`：

```ts
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("chart-1"),
  sortOrder: integer("sort_order").notNull().default(0),
});
```

`src/lib/db/index.ts` 的 `initTables` 對應修改 CREATE TABLE。

### 預設色盤

定義在 `src/lib/constants.ts`：

```ts
export const TAG_COLORS = [
  { value: "chart-1", label: "灰藍" },
  { value: "chart-2", label: "琥珀" },
  { value: "chart-3", label: "橄欖" },
  { value: "chart-4", label: "紫藤" },
  { value: "chart-5", label: "赭紅" },
  { value: "primary", label: "主色" },
  { value: "text-dim", label: "淡灰" },
  { value: "destructive", label: "紅" },
] as const;

export type TagColor = typeof TAG_COLORS[number]["value"];
```

每個 value 對應 `var(--{value})` CSS 變數，確保 light/dark theme 都正確。

## API

### `GET /api/tags`

回傳當前使用者的所有 tag，依 sortOrder 排序。

```ts
Response: { tags: Array<{ id, name, color, sortOrder }> }
```

### `POST /api/tags`

新增 tag。

```ts
Body: { name: string, color?: TagColor }
Response: { id, name, color, sortOrder }
```

自動設 sortOrder 為目前最大值 + 1。

### `PATCH /api/tags/[id]`

更新 tag 名稱或顏色。

```ts
Body: { name?: string, color?: TagColor, sortOrder?: number }
Response: { id, name, color, sortOrder }
```

### `DELETE /api/tags/[id]`

刪除 tag。同時刪除所有 task_tags 關聯（DB CASCADE 處理）。

### `PUT /api/tasks/[id]/tags`

設定任務的 tag（整批覆蓋）。

```ts
Body: { tagIds: string[] }
Response: { tagIds: string[] }
```

先 DELETE 該 task 的所有 task_tags，再 INSERT 新的。

### `GET /api/cards` 修改

回傳的每張卡片多帶 `tags` 欄位：

```ts
cards: Array<{
  ...existing fields,
  tags: Array<{ id: string, name: string, color: string }>
}>
```

用 LEFT JOIN task_tags + tags 取得。

## UI 元件

### 1. View 切換（修改 cards-feed.tsx）

現有 list / grid 旁邊新增第三個 icon：`Columns3`（lucide）代表看板。

localStorage key 不變（`nudge:cards-view`），值新增 `"kanban"`。

### 2. 看板 View（新增）

**`src/components/cards/cards-kanban.tsx`**

- 水平捲動容器，每個 tag 一個 column
- Column header：tag 顏色圓點 + tag 名稱 + 卡片數量
- Column 內的卡片：標題 + description 預覽（strip HTML，~60 字）
- 點擊卡片 → 導航到 `/cards/[id]`
- 拖移用 `@dnd-kit/core`（專案已安裝），拖到另一個 column = 替換 tag

**Column 排序**：依 tag 的 sortOrder。

**卡片排序**：依 updatedAt desc（同 list/grid）。

### 3. Tag Picker（新增）

**`src/components/tags/tag-picker.tsx`**

用在卡片詳細頁和 task detail modal。

- 顯示目前的 tag（小 badge）
- 點擊打開 popover
- Popover 內：搜尋框 + tag 列表（checkbox 多選）+ 底部「新增 tag」
- 打字搜尋，沒有符合的 tag 時顯示「建立 "xxx"」按鈕
- 新增時跳出顏色選擇（色盤 grid）

### 4. Tag Badge（新增）

**`src/components/tags/tag-badge.tsx`**

小型標籤顯示元件，用在：
- 卡片 list / grid item
- Tag picker 已選取的 tag
- 看板卡片上（當卡片有多個 tag 時，顯示其他 tag 的小 badge）

樣式：小圓角方塊，背景用 `color-mix(in srgb, var(--{color}) 15%, transparent)`，文字用 `var(--{color})`。與既有 status badge 同風格。

### 5. Tag 管理（修改 settings-modal.tsx）

Settings modal 新增一個 section「標籤管理」：

- 列出所有 tag（顏色圓點 + 名稱 + 卡片數量）
- 可拖移排序（決定看板 column 順序）
- 點名稱可 inline 編輯
- 點顏色圓點開 color popover
- 刪除按鈕（確認後刪除）
- 底部「+ 新增標籤」按鈕

### 6. 卡片詳細頁 / Task Detail Modal（修改）

在 header 區域加入 Tag picker，位置在標題下方、日期資訊旁邊。

## 拖移行為細節

看板中拖移卡片到另一個 column：

1. 從來源 column 的 tag 移除（DELETE task_tags WHERE taskId = ? AND tagId = 來源 tag）
2. 加上目標 column 的 tag（INSERT task_tags）
3. 樂觀更新 UI
4. API 呼叫 `PUT /api/tasks/[id]/tags`，帶上更新後的完整 tagIds

若卡片有多個 tag（出現在多個 column），拖移只替換「來源 column 的 tag → 目標 column 的 tag」，其他 tag 不變。

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 修改 | `src/lib/db/schema.ts` | tags 加 sortOrder，color 改預設值 |
| 修改 | `src/lib/db/index.ts` | initTables 加 sort_order 欄位 |
| 修改 | `src/lib/constants.ts` | 新增 TAG_COLORS 色盤 |
| 新增 | `src/app/api/tags/route.ts` | GET + POST tags |
| 新增 | `src/app/api/tags/[id]/route.ts` | PATCH + DELETE tag |
| 新增 | `src/app/api/tasks/[id]/tags/route.ts` | PUT task tags |
| 修改 | `src/app/api/cards/route.ts` | 回傳帶 tags 的卡片 |
| 新增 | `src/components/cards/cards-kanban.tsx` | 看板 view |
| 新增 | `src/components/tags/tag-picker.tsx` | Tag 選取 popover |
| 新增 | `src/components/tags/tag-badge.tsx` | Tag 小標籤 |
| 新增 | `src/components/tags/tag-color-picker.tsx` | 色盤選擇 |
| 新增 | `src/hooks/use-tags.ts` | SWR hook for tags |
| 修改 | `src/components/cards/cards-feed.tsx` | 新增 kanban view 切換 |
| 修改 | `src/components/cards/card-list-item.tsx` | 顯示 tag badge |
| 修改 | `src/components/cards/card-grid-item.tsx` | 顯示 tag badge |
| 修改 | `src/components/cards/card-detail.tsx` | 加入 tag picker |
| 修改 | `src/components/task/task-detail-modal.tsx` | 加入 tag picker |
| 修改 | `src/components/settings/settings-modal.tsx` | 新增標籤管理 section |
| 修改 | `src/hooks/use-cards-feed.ts` | CardItem type 加 tags |

## 邊界情況

1. **刪除 tag 時看板更新**：刪除後 column 消失，原本在該 column 的卡片移除該 tag（CASCADE）。需要 revalidate cards SWR。
2. **tag 重名**：不限制，但 UI 上會容易混淆。新增時若同名給 toast 提醒但不阻擋。
3. **拖移到已有該 tag 的卡片**：no-op，該卡片已在目標 column。
4. **所有 tag 都沒有卡片**：看板顯示空 column（只有 header），不隱藏。
5. **沒有任何 tag**：看板顯示空狀態提示「建立第一個標籤來開始使用看板」。

## 不在範圍內

- Tag 群組 / 樹狀結構
- Group by 第二層分類
- 日常行動頁顯示 tag
- 看板內直接新增卡片
- Tag 篩選器（list/grid view 依 tag 過濾）
- Tag 搜尋（在搜尋框搜 tag 名稱）
- 拖移排序 column（用 settings 的 sortOrder 控制）

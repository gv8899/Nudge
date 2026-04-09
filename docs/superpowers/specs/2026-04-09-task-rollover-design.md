# 任務滾動：過期未完成任務自動顯示

## 摘要

未完成的每日任務會自動出現在一個獨立的「過期」區塊中，當使用者瀏覽任何 >= 原始指派日期的頁面時即可看到。不會變動資料 — 純粹透過查詢實現。使用者可以選擇重新排程，或讓任務留在過期區塊直到處理為止。

## 核心決策

| 決策 | 選擇 |
|------|------|
| 資料變動 | 無 — 純查詢 |
| 顯示方式 | 獨立「過期」區塊，位於當天任務上方 |
| 排序 | 最舊的在最上面（拖越久越醒目） |
| 持續性 | 過期任務持續出現直到被處理 |
| 重新排程機制 | 建立新的 assignment，舊的標記完成 |

## 資料層

### Schema 變更

無。現有的 `dailyTaskAssignments` 和 `tasks` 表已足夠。

### API 變更：GET `/api/daily/[date]`

目前的查詢：
```sql
SELECT ... FROM dailyTaskAssignments
JOIN tasks ON tasks.id = dailyTaskAssignments.taskId
WHERE dailyTaskAssignments.date = :date
  AND tasks.userId = :userId
```

新增第二段查詢取得過期任務：
```sql
SELECT ... FROM dailyTaskAssignments
JOIN tasks ON tasks.id = dailyTaskAssignments.taskId
WHERE dailyTaskAssignments.date < :date
  AND dailyTaskAssignments.isCompleted = false
  AND tasks.userId = :userId
ORDER BY dailyTaskAssignments.date ASC
```

回應格式從：
```ts
{ tasks: DailyTask[], notes: Note[] }
```
改為：
```ts
{ tasks: DailyTask[], overdueTasks: DailyTask[], notes: Note[] }
```

每個過期任務包含原始的 `date` 欄位供顯示使用。

### API 變更：重新排程

當使用者選擇「排入今天」或「移到其他天」時：

1. 將原始的 `dailyTaskAssignment` 標記為 `isCompleted = true`
2. 建立新的 `dailyTaskAssignment`，目標日期設為選擇的日期，`isCompleted = false`

新增端點：

**POST `/api/daily/[date]/tasks/reschedule`**
```ts
body: { assignmentId: string, targetDate: string }
```

此端點：
- 將來源 assignment 設為 `isCompleted = true`
- 為 `targetDate` 建立新的 assignment，使用相同的 `taskId`，`isCompleted = false`
- 回傳新建立的 assignment

## 前端

### `useDaily` Hook

更新回傳型別，加入 `overdueTasks` 陣列。SWR key 維持不變（`/api/daily/[date]`）。

### `daily-view.tsx`

在現有任務列表上方新增「過期」區塊：

```
+----------------------------------+
| 過期未完成 (3)                    |
| -------------------------------- |
| [ ] 任務 from 4/5    [操作]      |
| [ ] 任務 from 4/6    [操作]      |
| [ ] 任務 from 4/8    [操作]      |
+----------------------------------+
| 今天的任務                        |
| -------------------------------- |
| [ ] 任務 A                       |
| [ ] 任務 B                       |
+----------------------------------+
```

- 區塊可收合（預設：展開）
- 每個過期任務顯示原始日期標籤
- 區塊標題顯示數量

### 過期任務操作

每個過期任務有一個下拉選單／操作按鈕：

1. **排入今天** — 建立今天的新 assignment，舊的標記完成
2. **移到...** — 開啟日期選擇器，同樣邏輯但目標日期不同
3. **完成** — 標記 assignment 完成（與一般任務完成相同）

「暫時不處理」是隱含行為 — 不點擊任何操作，任務繼續留在過期區塊。

### 過期區塊中的任務完成

勾選過期任務與一般任務完成方式相同 — 設定 `isCompleted = true`，並在需要時更新 `tasks.status` 為 "done"。

## 邊界情況

1. **任務被指派到多個日期**：一個任務可能有 4/5 和 4/8 的 assignment。如果 4/5 的未完成，它出現在過期區塊。如果 4/8 的也未完成，它出現在當天任務列表。這些是獨立的 assignment — 完成一個不影響另一個。

2. **瀏覽過去的日期**：瀏覽 4/5 時，過期區塊只顯示相對於 4/5 過期的任務（即 `date < 4/5`），保持行為一致。

3. **沒有過期任務**：過期區塊完全隱藏。

4. **拖放排序**：過期任務不屬於當天任務的拖放排序列表，它們在獨立區塊中，不可透過拖放重新排序。

## 不在範圍內

- 時段區分（Things 3 Evening 風格）
- 過期任務的通知或提醒
- 批次重新排程
- 超過 N 天自動封存

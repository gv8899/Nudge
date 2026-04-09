# 任務滾動功能實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 過期未完成的每日任務自動顯示在當天頁面的獨立「過期」區塊中

**Architecture:** 在 GET `/api/daily/[date]` 新增過期任務查詢（`date < :date AND isCompleted = false`），前端新增可收合的 overdue section。重新排程透過現有 PATCH 端點的 `moveToDate` 邏輯處理，改為保留舊 assignment（標記完成）而非刪除。

**Tech Stack:** Next.js 16, Drizzle ORM, SWR, React, Lucide icons, date-fns

---

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 修改 | `src/app/api/daily/[date]/route.ts` | 新增過期任務查詢 |
| 修改 | `src/app/api/daily/[date]/tasks/route.ts` | 修改 PATCH moveToDate 邏輯：保留舊 assignment |
| 修改 | `src/lib/types.ts` | DailyData 加入 overdueTasks |
| 修改 | `src/components/daily/daily-view.tsx` | 渲染過期區塊 + 操作處理 |
| 新增 | `src/components/daily/overdue-section.tsx` | 過期任務區塊元件 |

---

### Task 1: API — 過期任務查詢

**Files:**
- Modify: `src/app/api/daily/[date]/route.ts:16-44`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: 更新 DailyData 型別**

在 `src/lib/types.ts` 的 `DailyData` 型別加入 `overdueTasks`：

```ts
export interface DailyData {
  date: string;
  assignments: DailyTaskAssignment[];
  overdueTasks: DailyTaskAssignment[];
  noteContent: string;
}
```

- [ ] **Step 2: 在 API route 新增過期任務查詢**

在 `src/app/api/daily/[date]/route.ts` 的 `GET` handler 中，在現有 `assignments` 查詢之後加入：

```ts
import { eq, and, lt } from "drizzle-orm";

// 在現有 assignments 查詢之後加入
const overdueTasks = db
  .select({
    id: dailyTaskAssignments.id,
    taskId: dailyTaskAssignments.taskId,
    date: dailyTaskAssignments.date,
    isCompleted: dailyTaskAssignments.isCompleted,
    sortOrder: dailyTaskAssignments.sortOrder,
    task: {
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      completedAt: tasks.completedAt,
      remindAt: tasks.remindAt,
      sortOrder: tasks.sortOrder,
    },
  })
  .from(dailyTaskAssignments)
  .innerJoin(tasks, eq(dailyTaskAssignments.taskId, tasks.id))
  .where(
    and(
      lt(dailyTaskAssignments.date, date),
      eq(dailyTaskAssignments.isCompleted, false),
      eq(tasks.userId, user.id)
    )
  )
  .orderBy(dailyTaskAssignments.date)
  .all();
```

- [ ] **Step 3: 更新回應格式**

將 `return NextResponse.json(...)` 改為：

```ts
return NextResponse.json({
  date,
  assignments,
  overdueTasks,
  noteContent: note?.content || "",
});
```

- [ ] **Step 4: 手動測試 API**

瀏覽器開啟 `http://localhost:3000/api/daily/2026-04-09`，確認回應包含 `overdueTasks` 陣列。如果有過去未完成的任務，應該出現在這個陣列中。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/daily/[date]/route.ts src/lib/types.ts
git commit -m "feat: API 回傳過期未完成任務"
```

---

### Task 2: API — 重新排程邏輯（保留舊 assignment）

**Files:**
- Modify: `src/app/api/daily/[date]/tasks/route.ts:94-131`

- [ ] **Step 1: 修改 PATCH moveToDate 邏輯**

目前的 `moveToDate` 邏輯是刪除舊 assignment，改為標記 `isCompleted = true`：

在 `src/app/api/daily/[date]/tasks/route.ts` 的 PATCH handler 中，找到 moveToDate 區塊，將：

```ts
db.delete(dailyTaskAssignments)
  .where(eq(dailyTaskAssignments.id, assignmentId))
  .run();
```

改為：

```ts
db.update(dailyTaskAssignments)
  .set({ isCompleted: true })
  .where(eq(dailyTaskAssignments.id, assignmentId))
  .run();
```

- [ ] **Step 2: 手動測試**

在 app 中把一個任務移到其他天，確認：
- 舊 assignment 變成 `isCompleted = true`（不是被刪除）
- 新日期出現新的 assignment

- [ ] **Step 3: Commit**

```bash
git add src/app/api/daily/[date]/tasks/route.ts
git commit -m "feat: 重新排程保留舊 assignment 而非刪除"
```

---

### Task 3: 前端 — 過期任務區塊元件

**Files:**
- Create: `src/components/daily/overdue-section.tsx`

- [ ] **Step 1: 建立 overdue-section.tsx**

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CalendarClock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import type { DailyTaskAssignment } from "@/lib/types";
import type { TaskStatus } from "@/lib/constants";

interface OverdueSectionProps {
  overdueTasks: DailyTaskAssignment[];
  currentDate: string;
  onToggleComplete: (assignmentId: string, taskId: string, completed: boolean) => void;
  onReschedule: (assignmentId: string, targetDate: string) => void;
}

export function OverdueSection({
  overdueTasks,
  currentDate,
  onToggleComplete,
  onReschedule,
}: OverdueSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (overdueTasks.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left py-2 px-1 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <CalendarClock className="h-4 w-4" />
        <span>過期未完成 ({overdueTasks.length})</span>
      </button>

      {isExpanded && (
        <div className="space-y-1 pl-1">
          {overdueTasks.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 py-2 px-3 rounded-lg bg-surface/50 border border-amber-500/20"
            >
              {/* 勾選完成 */}
              <button
                onClick={() => onToggleComplete(a.id, a.taskId, true)}
                className="h-5 w-5 rounded-full border-2 border-amber-500/40 hover:border-amber-400 hover:bg-amber-400/10 transition-colors flex-shrink-0"
                aria-label={`完成任務：${a.task.title}`}
              />

              {/* 任務標題 + 日期標籤 */}
              <div className="flex-1 min-w-0">
                <span className="text-sm text-text truncate block">
                  {a.task.title}
                </span>
              </div>

              <span className="text-xs text-amber-400/70 flex-shrink-0">
                {format(parseISO(a.date), "M/d")}
              </span>

              {/* 操作按鈕 */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onReschedule(a.id, currentDate)}
                  className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  排入今天
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/daily/overdue-section.tsx
git commit -m "feat: 新增過期任務區塊元件"
```

---

### Task 4: 前端 — 整合到 daily-view

**Files:**
- Modify: `src/components/daily/daily-view.tsx`

- [ ] **Step 1: 匯入 OverdueSection 並新增 reschedule handler**

在 `daily-view.tsx` 頂部加入匯入：

```ts
import { OverdueSection } from "@/components/daily/overdue-section";
```

在 `handleMoveToDate` 之後加入 reschedule handler：

```ts
const handleReschedule = async (
  assignmentId: string,
  targetDate: string
) => {
  // 樂觀移除 overdue 任務
  if (data) {
    const optimistic = {
      ...data,
      overdueTasks: (data.overdueTasks || []).filter((a) => a.id !== assignmentId),
    };
    mutate(optimistic, false);
  }

  await fetch(`/api/daily/${currentDate}/tasks`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignmentId, moveToDate: targetDate }),
  });
  mutate();
};
```

- [ ] **Step 2: 新增 overdue toggle complete handler**

在 `handleReschedule` 之後加入：

```ts
const handleOverdueToggleComplete = async (
  assignmentId: string,
  taskId: string,
  completed: boolean
) => {
  // 樂觀移除
  if (data) {
    const optimistic = {
      ...data,
      overdueTasks: (data.overdueTasks || []).filter((a) => a.id !== assignmentId),
    };
    mutate(optimistic, false);
  }

  await fetch(`/api/daily/${currentDate}/tasks`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignmentId, taskId, isCompleted: completed }),
  });
  mutate();
};
```

- [ ] **Step 3: 在 JSX 中插入 OverdueSection**

在 `<div className="space-y-0 pt-2">` 內、`<DndContext>` 之前插入：

```tsx
<OverdueSection
  overdueTasks={data?.overdueTasks || []}
  currentDate={currentDate}
  onToggleComplete={handleOverdueToggleComplete}
  onReschedule={handleReschedule}
/>
```

- [ ] **Step 4: 手動測試**

1. 建立一個過去日期的任務（如 4/7），不要完成它
2. 回到今天（4/9），確認過期區塊出現
3. 點擊「排入今天」，確認任務從過期區移到今天的列表
4. 建立另一個過期任務，直接勾選完成，確認它消失
5. 收合/展開過期區塊
6. 確認沒有過期任務時區塊不顯示

- [ ] **Step 5: Commit**

```bash
git add src/components/daily/daily-view.tsx
git commit -m "feat: 在每日頁面整合過期任務區塊"
```

---

### Task 5: 驗證與收尾

- [ ] **Step 1: 邊界情況測試**

1. **瀏覽過去日期**：切到 4/5，確認過期區塊只顯示 `date < 4/5` 的任務
2. **沒有過期任務**：找一個沒有過期任務的日期，確認區塊不顯示
3. **多天累積**：建立 4/3、4/5、4/7 的未完成任務，確認排序為 4/3 → 4/5 → 4/7（最舊在上）

- [ ] **Step 2: 確認拖放不受影響**

在有過期任務的情況下，確認今天的任務列表拖放排序正常運作，過期區塊不參與拖放。

- [ ] **Step 3: 最終 commit（如有修正）**

```bash
git add -A
git commit -m "fix: 任務滾動邊界情況修正"
```

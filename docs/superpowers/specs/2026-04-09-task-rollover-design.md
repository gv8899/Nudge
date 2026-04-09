# Task Rollover: Overdue Tasks Auto-Display

## Summary

Uncompleted daily tasks automatically appear in a dedicated "Overdue" section when viewing any date >= the original assignment date. No data mutation occurs — this is purely query-based. Users can then choose to reschedule, or leave tasks in the overdue section until they act on them.

## Core Decisions

| Decision | Choice |
|----------|--------|
| Data mutation | None — query-based only |
| Display style | Separate "Overdue" section above today's tasks |
| Sort order | Oldest assignment first (most overdue on top) |
| Persistence | Overdue tasks keep appearing until resolved |
| Reschedule mechanism | New assignment created, old one marked completed |

## Data Layer

### Schema Changes

None. The existing `dailyTaskAssignments` and `tasks` tables are sufficient.

### API Changes: GET `/api/daily/[date]`

Currently queries:
```sql
SELECT ... FROM dailyTaskAssignments
JOIN tasks ON tasks.id = dailyTaskAssignments.taskId
WHERE dailyTaskAssignments.date = :date
  AND tasks.userId = :userId
```

New behavior — add a second query for overdue tasks:
```sql
SELECT ... FROM dailyTaskAssignments
JOIN tasks ON tasks.id = dailyTaskAssignments.taskId
WHERE dailyTaskAssignments.date < :date
  AND dailyTaskAssignments.isCompleted = false
  AND tasks.userId = :userId
ORDER BY dailyTaskAssignments.date ASC
```

Response shape changes from:
```ts
{ tasks: DailyTask[], notes: Note[] }
```
to:
```ts
{ tasks: DailyTask[], overdueTasks: DailyTask[], notes: Note[] }
```

Each overdue task includes its original `date` field for display.

### API Changes: Reschedule Action

When user chooses "Schedule to today" or "Move to another day":

1. Mark the original `dailyTaskAssignment` as `isCompleted = true`
2. Create a new `dailyTaskAssignment` with the target date and `isCompleted = false`

This reuses the existing POST `/api/daily/[date]/tasks` endpoint (create assignment) plus PATCH to mark old one complete. May be combined into a single new endpoint if cleaner:

**POST `/api/daily/[date]/tasks/reschedule`**
```ts
body: { assignmentId: string, targetDate: string }
```

This endpoint:
- Sets `isCompleted = true` on the source assignment
- Creates new assignment for `targetDate` with same `taskId`, `isCompleted = false`
- Returns the new assignment

## Frontend

### `useDaily` Hook

Update return type to include `overdueTasks` array. SWR key remains the same (`/api/daily/[date]`).

### `daily-view.tsx`

Add an "Overdue" section above the existing task list:

```
+----------------------------------+
| Overdue (3)                      |
| -------------------------------- |
| [ ] Task from 4/5    [actions]   |
| [ ] Task from 4/6    [actions]   |
| [ ] Task from 4/8    [actions]   |
+----------------------------------+
| Today's Tasks                    |
| -------------------------------- |
| [ ] Task A                       |
| [ ] Task B                       |
+----------------------------------+
```

- Section is collapsible (default: expanded)
- Each overdue task shows a date badge with its original date
- Section header shows count

### Overdue Task Actions

Each overdue task has a dropdown/action menu with:

1. **Schedule to today** — creates new assignment for today, marks old one done
2. **Move to...** — opens date picker, same logic with chosen date
3. **Complete** — marks the assignment as completed (same as normal task completion)

"Do nothing" is implicit — just don't click anything, it stays in overdue.

### Task Completion in Overdue Section

Checking off an overdue task marks it completed the same way as a normal task — sets `isCompleted = true` on the assignment and updates `tasks.status` to "done" if needed.

## Edge Cases

1. **Task assigned to multiple dates**: A task could have assignments on 4/5 and 4/8. If 4/5's assignment is incomplete, it shows in overdue. If 4/8's is also incomplete, it shows in today's list. These are independent assignments — completing one doesn't affect the other.

2. **Viewing past dates**: When viewing 4/5 (a past date), the overdue section should only show tasks overdue *relative to 4/5* (i.e., `date < 4/5`). This keeps the behavior consistent regardless of which date is being viewed.

3. **No overdue tasks**: The overdue section is hidden entirely when empty.

4. **Drag and drop**: Overdue tasks are NOT part of the drag-sortable list for today's tasks. They live in their own section and cannot be reordered via drag.

## Out of Scope

- Evening/time-of-day segmentation (Things 3 style)
- Notifications or reminders for overdue tasks
- Bulk reschedule actions
- Auto-archive after N days overdue

# Flutter App 行動頁 — Bug 清單

經過程式碼審查，以下是行動頁功能的已知問題：

## P0：功能壞掉

### 1. Checkbox 點擊被 InkWell 攔截
**檔案：** `task_card.dart:21-82`
**問題：** 整個 TaskCard 被 `InkWell(onTap: push detail)` 包住。裡面的 `GestureDetector(onTap: onToggleComplete)` 和 InkWell 的 onTap 衝突。點 checkbox 區域時 InkWell 也會觸發，可能導致先跳到詳細頁而不是 toggle checkbox。
**修法：** 把 InkWell 從整行改成只包標題文字，或在 checkbox 的 GestureDetector 加上 `behavior: HitTestBehavior.opaque` 確保攔截事件。

### 2. 詳細頁 Description 不能編輯
**檔案：** `task_detail_screen.dart:128-131`
**問題：** Description 用 `HtmlWidget` 唯讀渲染。Web 版用 TipTap 可以直接編輯。Flutter 目前沒有富文本編輯器。
**修法：** 這是 Phase 4 的範圍，但至少可以加一個基本的 TextField 讓使用者輸入純文字。

### 3. 完成任務後沒有同步更新 task status 為 done
**檔案：** `tasks_provider.dart` — `toggleComplete` 方法
**問題：** Web 的 PATCH handler 在 `isCompleted: true` 時會同時把 task status 改成 "done"。Flutter 端呼叫相同 API，所以後端行為一致。但問題是 `refreshTasks()` 用的是 `ref.invalidate`，它是非同步的 — UI 可能在 API 回來之前就重新渲染，看起來像沒反應。
**修法：** 加 optimistic update — 在呼叫 API 前先更新本地 state。

### 4. ReorderableListView 和 InkWell/GestureDetector 衝突
**檔案：** `task_list.dart` + `task_card.dart`
**問題：** ReorderableListView 需要長按觸發拖曳，但 TaskCard 內有多個 GestureDetector。長按可能被內部元素攔截。
**修法：** ReorderableListView 用 `buildDefaultDragHandles: false`，改用專門的 drag handle（像 Web 的 GripVertical icon）。

## P1：體驗問題

### 5. 日曆 bar 的 weekDots 可能因為 endStr 格式錯誤而取不到資料
**檔案：** `tasks_provider.dart:15-23`
**問題：** `weekDotsProvider` 手動組 endStr 格式，如果 start 是某些邊界情況（跨年等）可能出錯。
**修法：** 用 `formatDate()` from `date_utils.dart`。

### 6. 新增任務沒有 loading 狀態
**檔案：** `task_create_input.dart`
**問題：** 按 Enter 後如果 API 慢，使用者可能重複按。
**修法：** 加 loading flag 防止重複提交。

### 7. 詳細頁返回後主列表沒刷新
**檔案：** `tasks_screen.dart` + `task_detail_screen.dart`
**問題：** 在詳細頁改了 title 或 status，返回主畫面時 `dailyDataProvider` 不會自動刷新（因為是 FutureProvider.family，沒有被 invalidate）。
**修法：** 在 GoRouter 的 `onExit` 或 `PopScope` 裡 invalidate dailyDataProvider。

## P2：缺少的功能

### 8. 沒有任務標題 inline 編輯
Web 版可以在任務列表直接點標題進入 inline 編輯模式。Flutter 版只能進詳細頁改。

### 9. 沒有 optimistic update
Web 版打勾後立即視覺更新，API 在背景跑。Flutter 版等 API 回來再 invalidate，會有明顯延遲。

### 10. 沒有刪光標題自動封存
Web 版在任務列表把標題刪光再按 Backspace 會封存任務。Flutter 沒有這個行為。

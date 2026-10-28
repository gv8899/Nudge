# 任務列 checklist 子項目（第一階段）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在今日清單的任務列上顯示任務內文裡的待辦項目（進度 `2/5 ▾`、可勾、可新增），並讓母任務與子項目雙向同步，Web + macOS + iOS。

**Architecture:** 子項目完全由 `tasks.description` HTML 推導，不改 schema。一份純邏輯模組（TS `src/lib/checklist.ts` ↔ Swift `NudgeCore/ChecklistHTML.swift`）負責解析／改寫 HTML 與判斷「跨過全勾線」，兩邊吃同一份 JSON fixture。UI 層在既有任務列下方掛子項目區；寫入走既有帶 `baseUpdatedAt` 的版本檢查 PATCH，409 時用「意圖」重套。

**Tech Stack:** Next.js 16 / React / SWR / next-intl / vitest；SwiftUI（NudgeKit：NudgeCore / NudgeData / NudgeUI）/ swift-testing。

**Spec:** `docs/superpowers/specs/2026-10-28-task-checklist-progress-design.md`

## Global Constraints

- 不改 DB schema、不加 migration、不加新 API route。
- **重複任務（`assignment.isRecurring === true`）完全不顯示子項目、不做任何雙向同步、選單不出現「新增子項目」。**
- 沒有任何待辦項目的任務：外觀與現在完全相同（無膠囊、無子項目區）。
- 顏色只用 design token：Web 用 Tailwind token class（`text-text-dim`、`text-primary`、`bg-primary`、`border-text-dim`、`hover:bg-muted`…），禁止 hex / Tailwind 預設色；Swift 只用 `Color.nudgeXxx`，checkbox 用 `NudgeCheckbox`，icon-only 按鈕用 `IconButton`。
- i18n：先改 `i18n/canonical/zh-TW.json` → `npm run i18n:sync`（en/ja 待翻譯在對話中補）→ 再 sync；Apple 端把同名 key 手動鏡像進 `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`（zh-Hant / en / ja）。`src/messages/*.json` 不准手改。
- 編輯器實際輸出的待辦 HTML（tiptap 3.32，已實測）：
  `<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>文字</p></div></li></ul>`；未勾為 `data-checked="false"` 且 `<input type="checkbox">`（無 `checked` 屬性）。**改勾選狀態時 `data-checked` 與 `<input>` 的 `checked="checked"` 兩處都要改。**
- 兩種結構都存在：「一個 `<ul>` 一個 `<li>`」（Web 的 `SplitTaskList`）與「一個 `<ul>` 多個 `<li>`」（Apple bundle 停用 SplitTaskList、onboarding 範例）。
- 改寫 HTML 時，除了目標節點，其餘字元必須原封不動。
- Swift 與 TS 純邏輯模組互為鏡像：檔頭註明「改一邊，兩邊測試都要過」（比照 `RemoteChangeDecision.swift`）。

## Review Focus

1. **Mac 右欄詳情與清單同時開著同一個任務**：清單上的勾選／新增若照常寫入，右欄編輯器下一次 debounce 存檔會用舊內容蓋掉（base 已被推進，server 不會回 409）。預期：右欄正顯示該任務時，清單操作改由右欄編輯器代為寫入（先 flush → 套用 → 存檔 → 重載），兩邊立即一致、不互蓋。→ Task 7 手動步驟。
2. **重複但文字相同的子項目**（兩個都叫「買牛奶」）：以 index 切換，409 重套時文字比對仍能定位正確那一個；index 已不存在或文字不符則放棄重套、以最新內容刷新。→ Task 1 fixture `toggle-duplicate-text`、`rebase-index-mismatch`。
3. **子項目文字含格式或特殊字元**（`<strong>`、`&amp;`、`<a>`、emoji）：清單顯示解碼後的純文字；新增時使用者輸入的 `<`、`&`、`"` 要 escape，不能注入 HTML。→ Task 1 fixture `marks-and-entities`、`append-escapes`。
4. **內文有非待辦內容（段落、圖片 `<img data-attachment-id>`、標題）夾在待辦之間**：改寫後這些內容位元組不變。→ Task 1 fixture `mixed-content-untouched`。
5. **新增子項目到「已完成」的母任務**：不得把母任務拉回未完成；在詳情裡新增一個未勾項目亦同。→ Task 1 transition fixture `append-does-not-reopen`。

---

## File Structure

| 檔案 | 責任 |
|---|---|
| `src/lib/checklist.ts`（新） | 純邏輯：解析、改寫、意圖重套、轉變判斷 |
| `src/lib/checklist.test.ts`（新） | 吃 fixture 的 vitest |
| `src/lib/checklist-cases.json`（新） | TS / Swift 共用 fixture |
| `src/lib/checklist-save.ts`（新） | Web：帶版本檢查存檔 + 409 重套 |
| `src/lib/checklist-collapse.ts`（新） | Web：收合記憶（localStorage） |
| `src/components/task/task-checklist.tsx`（新） | Web：膠囊 + 子項目 + 新增輸入框 |
| `src/components/task/task-card.tsx`（改） | 掛 checklist、選單項目、母任務→全勾、詳情路徑同步 |
| `src/components/daily/daily-view.tsx`、`overdue-section.tsx`（改） | 傳 `onChecklistEdit`、處理同步 |
| `apple/NudgeKit/Sources/NudgeCore/ChecklistHTML.swift`（新） | Swift 鏡像 |
| `apple/NudgeKit/Tests/NudgeCoreTests/ChecklistHTMLTests.swift`（新） | 讀同一份 fixture |
| `apple/NudgeKit/Sources/NudgeData/TaskRepository.swift`（改） | `saveChecklistEdit` |
| `apple/NudgeKit/Sources/NudgeUI/Daily/ChecklistCollapseStore.swift`（新） | UserDefaults 收合記憶 |
| `apple/NudgeKit/Sources/NudgeUI/Daily/TaskChecklistView.swift`（新） | SwiftUI 子項目區 |
| `TaskRowView.swift`、`TaskRowMenu.swift`、`TaskListView.swift`、`OverdueSectionView.swift`、`DailyHostView.swift`（改） | 接線與同步 |

---

### Task 1: 共用 fixture + TS 純邏輯模組

**Files:**
- Create: `src/lib/checklist-cases.json`, `src/lib/checklist.ts`, `src/lib/checklist.test.ts`

**Interfaces:**
- Produces（`src/lib/checklist.ts`）：
  ```ts
  export interface ChecklistItem { text: string; checked: boolean }
  export type ChecklistEdit =
    | { kind: "toggle"; index: number; text: string; checked: boolean }
    | { kind: "append"; text: string }
    | { kind: "checkAll" };
  export type ChecklistTransition = "became-all-checked" | "left-all-checked" | "none";
  export function parseChecklist(html: string | null | undefined): ChecklistItem[];
  export function isAllChecked(items: ChecklistItem[]): boolean; // length>0 && every checked
  export function applyChecklistEdit(html: string | null | undefined, edit: ChecklistEdit): string | null;
  export function checklistTransition(beforeHtml: string | null | undefined, afterHtml: string | null | undefined): ChecklistTransition;
  ```
- Fixture schema（`checklist-cases.json`）：
  ```json
  {
    "parse":      [{ "name": "", "html": "", "items": [{ "text": "", "checked": true }] }],
    "edit":       [{ "name": "", "html": "", "edit": { "kind": "toggle", "index": 0, "text": "", "checked": true }, "expected": "<html> 或 null" }],
    "transition": [{ "name": "", "before": "", "after": "", "expected": "became-all-checked" }]
  }
  ```

規則（fixture 要逐條覆蓋）：
- `parseChecklist`：依文件順序收集所有 `<li … data-type="taskItem">`；`checked` 取 `data-checked="true"`；`text` = 該 `<li>` 內 `<div>` 的文字內容，去掉所有 tag、解碼 `&amp; &lt; &gt; &quot; &#39; &nbsp;`、trim。`null`/空字串 → `[]`。
- `applyChecklistEdit`：
  - `toggle`：第 `index` 項存在且其 `text` 等於 `edit.text` → 改 `data-checked` 與 `<input>` 的 `checked="checked"`（加或移除）；否則回 `null`。已是目標狀態 → 回原字串。
  - `checkAll`：所有未勾項目改成勾選；沒有任何項目 → 回原字串。
  - `append`：`text` trim 後為空 → `null`。插入 `<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>ESCAPED</p></div></li>`：有既有項目時插在最後一個 taskItem 的 `</li>` 之後（同一個 `<ul>` 內）；沒有任何項目時在字串尾端加 `<ul data-type="taskList">…</ul>`。escape `& < > "`。
- `checklistTransition`：`became-all-checked` = `!isAllChecked(before) && isAllChecked(after)`；`left-all-checked` = `isAllChecked(before) && !isAllChecked(after) && checkedCount(after) < checkedCount(before)`；其餘 `none`。

- [ ] **Step 1: 寫 fixture**，至少包含以下 case（name 即 vitest / swift-testing 的案例名）：
  - parse：`empty-null`、`no-checklist`（只有 `<p>`）、`single-ul-single-li`（用 Global Constraints 的實測 HTML）、`single-ul-multi-li`、`multi-ul`、`marks-and-entities`（`<strong>a &amp; &lt;b&gt;</strong>` → `a & <b>`）、`mixed-content-untouched`（段落 + `<img src="/api/attachments/x" data-attachment-id="x">` + `<h2>` 夾在兩個待辦之間）。
  - edit：`toggle-check`、`toggle-uncheck`（確認 `checked="checked"` 被移除）、`toggle-noop-same-state`、`toggle-duplicate-text`（兩項同名，index 1 只改第二個）、`rebase-index-mismatch`（text 不符 → `null`）、`toggle-out-of-range` → `null`、`check-all-mixed`、`check-all-empty`、`append-to-multi-li-ul`、`append-to-split-uls`（插進最後一個 `<ul>`）、`append-no-checklist`（加在尾端）、`append-escapes`（輸入 `<b>&"` → `&lt;b&gt;&amp;&quot;`）、`append-blank` → `null`、`mixed-content-untouched`（toggle 後非目標區段字元完全一致）。
  - transition：`became-all`、`left-all-by-uncheck`、`append-does-not-reopen`（before 全勾 2 項、after 多一個未勾 → `none`）、`delete-last-unchecked`（before 1 勾 1 未勾、after 只剩 1 勾 → `became-all-checked`）、`zero-to-zero` → `none`、`null-before`。

- [ ] **Step 2: 寫 `checklist.test.ts`**：`import cases from "./checklist-cases.json"`，對三組各用 `it.each` 跑：`expect(parseChecklist(c.html)).toEqual(c.items)`、`expect(applyChecklistEdit(c.html, c.edit)).toBe(c.expected)`、`expect(checklistTransition(c.before, c.after)).toBe(c.expected)`。

- [ ] **Step 3: 跑測試確認失敗**
  Run: `npx vitest run src/lib/checklist.test.ts`
  Expected: FAIL（`checklist` 模組不存在）

- [ ] **Step 4: 實作 `src/lib/checklist.ts`**：字串掃描（regex 定位 `<li[^>]*data-type="taskItem"[^>]*>` 與對應 `</li>`；`nested:false` 保證 taskItem 不巢狀），不要用 DOMParser（Swift 端要能逐字鏡像、也要在 server/test 環境跑）。檔頭註明鏡像 `ChecklistHTML.swift`。

- [ ] **Step 5: 跑測試確認通過**
  Run: `npx vitest run src/lib/checklist.test.ts`
  Expected: PASS（全部 case）

- [ ] **Step 6: Commit**
  ```bash
  git add src/lib/checklist.ts src/lib/checklist.test.ts src/lib/checklist-cases.json
  git commit -m "feat(checklist): 解析/改寫任務內文待辦項目的純邏輯 + 共用 fixture"
  ```

---

### Task 2: Swift 鏡像 `ChecklistHTML`

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/ChecklistHTML.swift`, `apple/NudgeKit/Tests/NudgeCoreTests/ChecklistHTMLTests.swift`

**Interfaces:**
- Consumes: `src/lib/checklist-cases.json`（Task 1）
- Produces：
  ```swift
  public struct ChecklistItem: Equatable, Sendable { public let text: String; public let checked: Bool }
  public enum ChecklistEdit: Equatable, Sendable {
      case toggle(index: Int, text: String, checked: Bool)
      case append(text: String)
      case checkAll
  }
  public enum ChecklistTransition: Equatable, Sendable { case becameAllChecked, leftAllChecked, none }
  public enum ChecklistHTML {
      public static func parse(_ html: String?) -> [ChecklistItem]
      public static func isAllChecked(_ items: [ChecklistItem]) -> Bool
      public static func apply(_ edit: ChecklistEdit, to html: String?) -> String?
      public static func transition(before: String?, after: String?) -> ChecklistTransition
  }
  ```

- [ ] **Step 1: 寫測試**：`@Suite("ChecklistHTML")`；用 `URL(fileURLWithPath: #filePath)` 往上 4 層到 repo root 讀 `src/lib/checklist-cases.json`，以 `@Test(arguments:)` 對 parse / edit / transition 三組逐案比對（fixture 的 `"became-all-checked"` 對應 `.becameAllChecked`、`"left-all-checked"` → `.leftAllChecked`、`"none"` → `.none`；edit 的 `expected: null` → `nil`）。

- [ ] **Step 2: 跑測試確認失敗**
  Run: `cd apple/NudgeKit && swift test --filter ChecklistHTML`
  Expected: FAIL（`ChecklistHTML` 未定義）

- [ ] **Step 3: 實作 `ChecklistHTML.swift`**，演算法逐步對齊 TS 版；檔頭：「與 Web `src/lib/checklist.ts` 鏡像。改一邊，兩邊測試都要過。」

- [ ] **Step 4: 跑測試確認通過**
  Run: `cd apple/NudgeKit && swift test --filter ChecklistHTML`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add apple/NudgeKit/Sources/NudgeCore/ChecklistHTML.swift apple/NudgeKit/Tests/NudgeCoreTests/ChecklistHTMLTests.swift
  git commit -m "feat(apple): ChecklistHTML 鏡像 Web checklist 純邏輯"
  ```

---

### Task 3: i18n keys

**Files:**
- Modify: `i18n/canonical/zh-TW.json`（`task` 底下新增 `checklist` 物件）、`apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`
- Generated: `src/messages/*.json`、`i18n/canonical/en.json`、`ja.json`、`i18n/.i18n-cache.json`

**Interfaces:**
- Produces（Web `useTranslations("task")` 下的 `checklist.*`；Apple key 為 `task.checklist.*`）：

  | key | zh-TW |
  |---|---|
  | `task.checklist.add` | 新增子項目 |
  | `task.checklist.placeholder` | 輸入後按 Enter，Esc 結束 |
  | `task.checklist.progressAria` | 已完成 {done}/{total} 個子項目 |
  | `task.checklist.expand` | 展開子項目 |
  | `task.checklist.collapse` | 收合子項目 |
  | `task.checklist.itemAria` | {text}：{state} |

  （`{state}` 沿用既有 `task.stateCompleted` / `task.stateIncomplete`。）

- [ ] **Step 1:** 改 canonical → `npm run i18n:sync` → 依 `i18n/.pending-translations.md` 在對話中提供 en / ja → 再 `npm run i18n:sync`。
- [ ] **Step 2:** 把 6 個 key（zh-Hant / en / ja）鏡像進 `Localizable.xcstrings`，格式比照既有 `task.complete`；Swift 用 `String(localized:)` 時 `{done}` 等改為 `%lld` 格式參數，需要時在 xcstrings 用位置參數。
- [ ] **Step 3: 驗證**
  Run: `npm run i18n:check`
  Expected: 無錯誤
- [ ] **Step 4: Commit**
  ```bash
  git add i18n src/messages apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings
  git commit -m "feat(i18n): task.checklist.* 文案"
  ```

---

### Task 4: Web 存檔與收合記憶

**Files:**
- Create: `src/lib/checklist-save.ts`, `src/lib/checklist-save.test.ts`, `src/lib/checklist-collapse.ts`, `src/lib/checklist-collapse.test.ts`

**Interfaces:**
- Consumes: `applyChecklistEdit`, `ChecklistEdit`（Task 1）；`seedCardVersion`, `getCardVersion`, `patchCardField`（`src/lib/card-version.ts`）
- Produces：
  ```ts
  // checklist-save.ts
  export type ChecklistSaveResult =
    | { status: "saved"; description: string; updatedAt: string }
    | { status: "dropped"; latestDescription: string | null }; // 409 後重套失敗
  export async function saveChecklistEdit(
    task: { id: string; description: string | null; updatedAt: string },
    edit: ChecklistEdit,
  ): Promise<ChecklistSaveResult | null>; // null = 本地套用失敗（例如 toggle 文字不符），什麼都沒送

  // checklist-collapse.ts
  export function isChecklistCollapsed(taskId: string): boolean;
  export function setChecklistCollapsed(taskId: string, collapsed: boolean): void;
  ```

行為：
- `saveChecklistEdit`：`getCardVersion(id)` 為 null 才 `seedCardVersion(id, task.updatedAt)`（避免覆蓋詳情編輯器的基準）→ 本地 `applyChecklistEdit(task.description, edit)`，null 就回 null → `patchCardField(id, { description })`。`conflict` → 用 `latest.description` 重套一次：成功就再 PATCH 一次（只重試一次）；重套回 null → `{ status: "dropped", latestDescription }`。
- 收合：localStorage key `"nudge.checklistCollapsed"`，值為 task id 陣列 JSON；所有讀寫包 try/catch，失敗時當作未收合。

- [ ] **Step 1: 寫測試**（mock `global.fetch`）：
  - `saves toggled description with baseUpdatedAt`：斷言 fetch body 的 `description` 已含 `data-checked="true"`，且 `baseUpdatedAt` 等於 seed 的值。
  - `rebases once on 409 and resaves`：第一次回 409 + latest（多一個項目），第二次 200；斷言第二次 body 是「latest + 勾選」。
  - `drops when rebase text mismatches`：409 latest 的第 index 項文字不同 → 回 `dropped`，fetch 只呼叫一次。
  - `does not reseed when base already exists`。
  - collapse：`defaults to expanded`、`round-trips collapsed state`、`survives localStorage throwing`。
- [ ] **Step 2: 跑測試確認失敗** — Run: `npx vitest run src/lib/checklist-save.test.ts src/lib/checklist-collapse.test.ts`；Expected: FAIL
- [ ] **Step 3: 實作兩個模組**
- [ ] **Step 4: 跑測試確認通過** — 同上指令；Expected: PASS
- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/checklist-save.ts src/lib/checklist-save.test.ts src/lib/checklist-collapse.ts src/lib/checklist-collapse.test.ts
  git commit -m "feat(checklist): Web 存檔（409 重套）與收合記憶"
  ```

---

### Task 5: Web UI + 雙向同步

**Files:**
- Create: `src/components/task/task-checklist.tsx`
- Modify: `src/components/task/task-card.tsx`, `src/components/daily/daily-view.tsx`, `src/components/daily/overdue-section.tsx`

**Interfaces:**
- Consumes: Task 1、3、4 全部匯出
- Produces：
  ```ts
  // task-checklist.tsx
  export function TaskChecklistPill(props: {
    done: number; total: number; collapsed: boolean; onToggleCollapsed: () => void;
  }): JSX.Element;
  export function TaskChecklistBody(props: {
    items: ChecklistItem[];
    adding: boolean;                 // 由 TaskCard 控制（選單「新增子項目」設為 true）
    onToggleItem: (index: number) => void;
    onAppend: (text: string) => void;
    onAddingChange: (adding: boolean) => void;
  }): JSX.Element;
  // TaskCard 新增 prop：
  onChecklistEdit: (assignment: DailyTaskAssignment, edit: ChecklistEdit) => Promise<void>;
  ```

行為（皆以 spec 為準，此處列實作要點）：
- `TaskCard` 內 `items = assignment.isRecurring ? [] : parseChecklist(task.description)`。
- 膠囊位置：`MoveTaskPopover` 前、標題後；`items.length === 0` 時不渲染膠囊與 body。全勾時文字 `text-primary`，否則 `text-text-dim`；點擊 `stopPropagation`（不開 modal）。
- 收合狀態：未完成任務讀 `isChecklistCollapsed(task.id)`；**已完成任務一律從收合開始**，點膠囊只改本元件 state，不寫 localStorage。
- 子項目整行可點 → `onChecklistEdit(assignment, { kind: "toggle", index, text, checked: !checked })`；樣式：左緣對齊標題（`pl-[50px]` 依現有 grip+checkbox 寬度調整）、14px 勾選框、`text-sm`、已勾 `line-through text-text-dim`。每個子項目 `role="checkbox"` + `aria-label={t("checklist.itemAria", …)}`。
- 「＋ 新增子項目」列：已有子項目且展開時顯示在最下方；點擊 → 輸入框（Enter 新增並清空、Esc / blur 結束、空字串不送）。
- 選單：`renderMenuItems()` 在非重複任務加「＋ 新增子項目」→ 設 `adding=true` 並確保展開（同時 `setChecklistCollapsed(id,false)`）。
- **母任務 → 全勾**：checkbox onClick 在「由未完成改為完成、items 非空、未全勾」時，額外呼叫 `onChecklistEdit(assignment, { kind: "checkAll" })`。取消完成不動子項目。
- **詳情路徑同步**：`handleDescChange` 以 `lastDescRef`（初值 `task.description`，非 pending 時隨 prop 更新）作為 before，算 `checklistTransition(before, html)`：`became-all-checked` 且未完成 → `onToggleComplete(assignment.id, task.id, true)`；`left-all-checked` 且已完成 → `onToggleComplete(…, false)`；重複任務跳過。
- `daily-view.tsx`：實作 `handleChecklistEdit(assignment, edit)`：樂觀更新 SWR 中該 task 的 description → `saveChecklistEdit` → `saved` 時依 `checklistTransition(old, new)` 呼叫 `handleToggleComplete`（或 overdue 版 `handleOverdueToggleComplete`）→ `mutate()` + `invalidateCardsCache()`；`dropped`/`null` → `mutate()`。overdue 區與今日區分別傳入對應的 toggle 函式。

- [ ] **Step 1:** 實作 `task-checklist.tsx` 與 `TaskCard` 接線。
- [ ] **Step 2:** 實作 `daily-view.tsx` / `overdue-section.tsx` 的 `onChecklistEdit`。
- [ ] **Step 3: 驗證** — Run: `npx tsc --noEmit && npm test && npx next build`；Expected: 全過。
- [ ] **Step 4: 瀏覽器實測**（`npm run dev`，登入後在今日清單）逐項確認並截圖：
  1. 沒有待辦項目的任務外觀不變。
  2. `···` →「新增子項目」→ 連續新增 3 項（Enter），Esc 結束；打開詳情內容一致。
  3. 勾 2 項 → 膠囊 `2/3`；勾第 3 項 → 母任務自動完成並移到「已完成」區，該處子項目為收合、膠囊 `3/3 ▸`。
  4. 在已完成區展開，取消 1 項 → 母任務回到今天區。
  5. 勾母任務 → 子項目全勾。
  6. 打開詳情勾最後一個未勾項目 → 關閉後母任務已完成。
  7. 收合 → 重新整理 → 仍收合。
  8. 重複任務（內文有待辦）→ 不顯示膠囊、選單無「新增子項目」。
  9. 新增項目輸入 `<b>&"` → 顯示為純文字。
- [ ] **Step 5: Commit**
  ```bash
  git add src/components/task src/components/daily
  git commit -m "feat(web): 任務列 checklist 子項目（進度、勾選、新增、母子同步）"
  ```

---

### Task 6: Apple 存檔與收合記憶

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeData/TaskRepository.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/ChecklistCollapseStore.swift`
- Test: `apple/NudgeKit/Tests/NudgeCoreTests/ChecklistSaveTests.swift`（比照 `AttachmentUploadTests.swift` 的 mock URLProtocol 寫法；若 TaskRepository 不在 NudgeCore 可測範圍，改把重套邏輯抽成 NudgeCore 的 `ChecklistSave.rebase(edit:latestDescription:) -> String?` 並對它測）

**Interfaces:**
- Consumes: `ChecklistHTML`, `ChecklistEdit`（Task 2）；`CardVersionStore`, `saveCardFieldWithVersionCheck`
- Produces：
  ```swift
  public enum ChecklistSaveResult: Equatable, Sendable {
      case saved(description: String)
      case dropped(latestDescription: String)
  }
  // TaskRepository
  public func saveChecklistEdit(taskId: String, currentDescription: String, updatedAt: Date, edit: ChecklistEdit) async throws -> ChecklistSaveResult?
  // ChecklistCollapseStore（UserDefaults key "nudge.checklistCollapsed"，[String]）
  enum ChecklistCollapseStore {
      static func isCollapsed(_ taskId: String) -> Bool
      static func setCollapsed(_ taskId: String, _ collapsed: Bool)
  }
  ```

行為與 Web `saveChecklistEdit` 相同：`CardVersionStore.base(cardId:)` 為 nil 才 `seed`；本地 apply 失敗回 nil；`.conflict(latest)` 用 `latest.description` 重套一次再存，重套失敗回 `.dropped`。

- [ ] **Step 1: 寫測試**：`rebaseAppliesToLatest`、`rebaseDropsOnTextMismatch`、`doesNotReseedExistingBase`。
- [ ] **Step 2: 跑測試確認失敗** — Run: `cd apple/NudgeKit && swift test --filter ChecklistSave`；Expected: FAIL
- [ ] **Step 3: 實作**
- [ ] **Step 4: 跑測試確認通過** — 同上；Expected: PASS
- [ ] **Step 5: Commit**
  ```bash
  git add apple/NudgeKit
  git commit -m "feat(apple): checklist 存檔（409 重套）與收合記憶"
  ```

---

### Task 7: Apple UI + 雙向同步

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/TaskChecklistView.swift`
- Modify: `TaskRowView.swift`, `TaskRowMenu.swift`, `TaskListView.swift`, `OverdueSectionView.swift`, `DailyHostView.swift`

**Interfaces:**
- Consumes: Task 2、3、6
- Produces：
  ```swift
  struct TaskChecklistPill: View { let done: Int; let total: Int; let collapsed: Bool; let onToggle: () -> Void }
  struct TaskChecklistView: View {
      let items: [ChecklistItem]
      @Binding var isAdding: Bool
      let onToggleItem: (Int) -> Void
      let onAppend: (String) -> Void
  }
  // TaskRowMenu 新增參數：onAddChecklistItem: (() -> Void)?   // nil = 不顯示（重複任務）
  // TaskRowView、OverdueSectionView 新增參數：
  //   checklistItems: [ChecklistItem], onChecklistEdit: (ChecklistEdit) -> Void
  // 編輯器代寫通知（NudgeCore）：
  public enum ChecklistEditRouting {
      static let request: Notification.Name   // "nudge.checklist.editRequest"
      // userInfo: ["taskId": String, "edit": ChecklistEditBox]
      // 編輯器處理完 post "nudge.checklist.editApplied"，userInfo: ["taskId", "before": String, "after": String]
  }
  ```

行為：
- 與 Web 相同的顯示／收合／新增／已完成區預設收合規則。膠囊用 `.nudgeTextDim`，全勾 `.nudgePrimary`；子項目勾選框用 `NudgeCheckbox`（小尺寸若元件不支援，新增 size 參數而非自刻）。
- 新增輸入框：`TextField` + `.onSubmit`（新增後保持 focus）、Esc（macOS `.onExitCommand`）/ 失焦結束；iOS 鍵盤 return 同 Enter。
- 選單：iOS `Menu` 與 macOS popover 都加 `task.checklist.add`，`onAddChecklistItem == nil` 時不顯示。
- `DailyHostView`：
  - `applyChecklistEdit(_ assignment:, _ edit:)`：`markLocalMutation()` → `applyTaskPatchLocally` 樂觀改 description → `taskRepo.saveChecklistEdit` → `.saved` 時算 `ChecklistHTML.transition` 決定是否呼叫 `toggleComplete(assignment)`（只在需要翻轉時）→ `reloadSilently()`。
  - `toggleComplete`：由未完成→完成且 items 非空且未全勾時，額外 `applyChecklistEdit(assignment, .checkAll)`。
  - `updateTaskDescription(taskId:description:)`（詳情路徑）：寫入前取 dailyData 內該 task 舊 description 當 before，算 transition，找到對應的非重複 assignment（`assignments` 或 `overdueTasks`）後依規則 `toggleComplete`。
  - **編輯器代寫（Review Focus 1）**：`applyChecklistEdit` 開頭判斷 macOS `dashboardCardDetailCard?.id == assignment.task.id` → 不自己存，改 post `ChecklistEditRouting.request`。`CardDetailView` 收到同 id 的 request：取消並立即執行排隊中的 description 存檔（flush）→ `ChecklistHTML.apply(edit, to: descriptionHTML)`（nil 則忽略）→ 以 `applyRemote` 同樣的方式更新 `descriptionHTML` 並 `reloadToken += 1` → 立即存檔（`saveCardFieldWithVersionCheck`）→ post `editApplied`（含 before/after）。`DailyHostView` 收到 `editApplied` 時用 before/after 跑同一套 transition → `toggleComplete`，並 `applyTaskPatchLocally` 更新清單上的 description。

- [ ] **Step 1:** 實作 View 與接線。
- [ ] **Step 2: 驗證** — Run: `cd apple/NudgeKit && swift build && swift test`，再 `cd apple && xcodegen generate && xcodebuild -scheme Nudge-iOS -destination 'platform=iOS Simulator,name=iPhone 16' build` 與 `xcodebuild -scheme Nudge-macOS build`；Expected: 全部 BUILD SUCCEEDED / tests passed。（`xcodegen` 若未安裝：`brew install xcodegen`。）
- [ ] **Step 3: 模擬器實測**（iOS Simulator + macOS app 各跑一次 Task 5 Step 4 的 1–9），macOS 另測：右欄打開某任務詳情時，在清單勾子項目 → 右欄內文立即顯示勾選；在右欄打幾個字後立刻去清單勾另一項 → 打的字與勾選都保留；等 3 秒後重新整理，兩者皆在；清單新增子項目亦同；全勾時母任務自動完成。
- [ ] **Step 4: Commit**
  ```bash
  git add apple
  git commit -m "feat(apple): 任務列 checklist 子項目（進度、勾選、新增、母子同步）"
  ```

---

### Task 8: 跨平台收尾驗證

- [ ] **Step 1:** Web 與 Mac 同時開同一帳號：Web 勾子項目 → Mac 清單在即時同步後更新；Mac 新增子項目 → Web 更新。
- [ ] **Step 2:** `npm test`、`npm run lint`（error 數不得高於 main）、`npx next build`、`cd apple/NudgeKit && swift test` 全過。
- [ ] **Step 3:** 更新 `AGENTS.md`「架構備忘」加一節「任務 checklist 子項目」：資料來源 = description、TS↔Swift 鏡像與共用 fixture、重複任務排除（第二階段待做）、Mac 右欄開著同一任務時由編輯器代寫（ChecklistEditRouting）。
- [ ] **Step 4: Commit**
  ```bash
  git add AGENTS.md
  git commit -m "docs: AGENTS.md 補 checklist 子項目架構備忘"
  ```

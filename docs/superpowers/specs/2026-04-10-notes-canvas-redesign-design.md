# 日記頁 Canvas 改版設計

## 摘要

把目前「今天可編輯 + 時間軸歷史」混合的 `/notes` 頁，拆成兩個模式：

- **Canvas**（`/notes` 今天、`/notes/[date]` 特定日期）：Notion 式全畫布編輯體驗，支援區塊拖放排序
- **Feed**（`/notes/feed`）：既有的時間軸列表，但「今天的 entry」移除（因為今天改成預設進 canvas），每個 entry 可點擊進入該日 canvas

右上角一個 icon 按鈕在 canvas 與 feed 之間切換。

## 核心決策

| 項目 | 決定 |
|------|------|
| 路由拆分 | `/notes` canvas / `/notes/feed` / `/notes/[date]` |
| 默認進入 | `/notes` = 今天 canvas |
| 編輯器風格 | Notion 式（無框、置中欄位、無 bg 框） |
| 過去日記存取 | 只能透過 feed 進入（feed entry → `/notes/[date]`） |
| Canvas ↔ Feed 切換 | 頁首右上角單一 icon 按鈕 |
| Header | 完整：左頁面標題、中日期、右切換按鈕 |
| 區塊拖放 | 支援，Notion 式 drag handle |
| 一天幾則日記 | 仍然一則（一對一：date → content） |

## 路由與頁面

### `/notes` — 今天 Canvas

單純 redirect 或直接 render 當天日期的 canvas。採 server component + 計算 today 的方式，避免 client 端 `new Date()` 造成 hydration 問題（與 daily view 相同模式）。

```tsx
// src/app/(app)/notes/page.tsx
import { format } from "date-fns";
import { NotesCanvas } from "@/components/notes/notes-canvas";

export default function NotesPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  return <NotesCanvas date={today} isToday />;
}
```

### `/notes/[date]` — 特定日期 Canvas

從 feed 進入時用的 URL。需要驗證日期格式，若 date 正好是今天，redirect 到 `/notes` 保持單一 URL。

```tsx
// src/app/(app)/notes/[date]/page.tsx
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { NotesCanvas } from "@/components/notes/notes-canvas";

export default async function NotesDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const today = format(new Date(), "yyyy-MM-dd");
  if (date === today) redirect("/notes");
  // 驗證格式：yyyy-MM-dd
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/notes");
  return <NotesCanvas date={date} isToday={false} />;
}
```

### `/notes/feed` — Feed 列表頁

Header + 既有的時間軸列表（移除「今天」特殊條目，因為今天已經在 canvas）。

```tsx
// src/app/(app)/notes/feed/page.tsx
import { format } from "date-fns";
import { NotesFeedPage } from "@/components/notes/notes-feed-page";

export default function FeedPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  return <NotesFeedPage today={today} />;
}
```

## Canvas 元件（`NotesCanvas`）

### Props

```ts
interface NotesCanvasProps {
  date: string;       // yyyy-MM-dd
  isToday: boolean;   // 影響日期顯示與 header
}
```

### 結構

```tsx
<div className="mx-auto max-w-3xl px-4 md:px-6 py-6">
  {/* Header */}
  <header className="flex items-center justify-between mb-10">
    <h1 className="text-2xl font-bold text-foreground">日誌</h1>
    <div className="flex items-center gap-4">
      <span className="text-sm text-text-dim tabular-nums">
        {format(date, "M/d · EEEE")}
      </span>
      <Link href="/notes/feed" aria-label="切換到 feed" title="切換到 feed">
        <List className="h-5 w-5 text-text-dim hover:text-foreground" />
      </Link>
    </div>
  </header>

  {/* Canvas editor */}
  <NotesCanvasEditor date={date} />
</div>
```

### Canvas 編輯器元件（`NotesCanvasEditor`）

獨立元件，專門處理 TipTap canvas 的初始化、內容載入、儲存、區塊拖放。

- 使用既有的 TipTap 基礎（StarterKit + Placeholder）
- **移除 rounded-lg border bg-background 邊框** — 讓編輯器直接在頁面上
- 增加字級：`prose-lg` 風格（`text-lg` 或 `text-[17px]`），行距放寬
- Placeholder：`寫點什麼⋯⋯`（比 `記錄一下...` 更柔）
- 儲存邏輯：沿用現有 debounce 800ms PUT `/api/daily/{date}/notes`
- 載入：mount 時 GET `/api/daily/{date}/notes` 拿內容
- 日期切換：當 `date` prop 變動時，重設 content

### 區塊拖放

**範圍**：
- 頂層區塊（paragraph、heading 1/2/3、bulletList、orderedList、blockquote、codeBlock、horizontalRule）
- 不支援 nested 區塊（list item 內部不可拖）
- 拖放只能在文件層級

**交互設計**：
- Hover 任何頂層區塊時，**左側 margin 區出現 GripVertical icon**（類似 Notion）
- 按住 grip 拖動，可看到被拖元素變半透明，其他區塊出現位置指示線
- 放開後編輯器重排，debounce 自動儲存

**技術方向**：
- 用 TipTap 的 `NodeView` + `ProseMirror` 的 `ReplaceStep` 重排節點
- 或使用社群擴充套件（例如 `@tiptap-pro/extension-drag-handle`，若需付費則自建）
- 先嘗試輕量自建：用一個自訂 React 元件，透過 `editor.state.doc.forEach` 取得 top-level 節點位置，hover 時在左側覆蓋 drag handle。拖放用 HTML5 drag API 或 dnd-kit
- 如果技術複雜度過高，後退為 MVP：只支援「上移/下移」按鈕（hover 時出現 ↑↓）

**降級策略**：
如果在實作計畫中發現完整 drag handle 工程量過大，可以降級為「上下移動按鈕」(hover 時顯示 ↑ ↓ icon)。這仍然達到「能重排」的核心目標。

## Feed 頁面（`NotesFeedPage`）

基於既有 `NoteFeed` 元件調整：

### 變更

1. **移除「今天」特殊條目** — canvas 接管了今天，feed 只顯示歷史
2. **加上 Header**：
   - 左：`日誌` 頁面標題
   - 右：`PenLine` icon 切換按鈕，連到 `/notes`
3. **每個 note entry 可點擊**：外層包 `<Link href="/notes/{date}">`，整塊有 hover 樣式
4. **空狀態**：沒有任何歷史時顯示「還沒有過去的日記。現在先從今天開始寫吧。」+ 連到 `/notes` 的連結

### `NoteEntry` 變更

- 外層 `<article>` 改為 `<Link>` 或用 `<article>` 包 `<Link>`
- Hover 時 `bg-muted/30` 微亮、cursor-pointer
- 右上角不加「編輯」icon，整塊即可點擊
- 移除現有「isLast」的視覺線段控制？→ 保留（feed 結尾依然需要視覺收斂）

## Sidebar 行為

現有 `app-sidebar.tsx` 的 `navItems` 有 `{ href: "/notes", match: "/notes" }`。

**變更**：
- `href` 不變 — sidebar 點擊永遠回到 `/notes` 今天 canvas
- `match` 保持 `"/notes"` — canvas、`/notes/[date]`、`/notes/feed` 都會 highlight 日誌 icon

## URL 與導覽流程

```
Sidebar「日誌」 ──► /notes (today canvas)
                        │
                        │  toggle icon
                        ▼
                   /notes/feed
                        │
                        │  click entry
                        ▼
                   /notes/2026-04-05 (past canvas)
                        │
                        │  toggle icon → /notes/feed
```

**需保證**：
- `/notes/[date]` 當 date = today 時 redirect 到 `/notes`，避免 state 分裂
- Feed 連結到 `/notes/{date}` 直接用 date 不判斷是否今天（由 server route 自動處理）

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 修改 | `src/app/(app)/notes/page.tsx` | 改為渲染 today canvas |
| 新增 | `src/app/(app)/notes/[date]/page.tsx` | 特定日期 canvas，today 則 redirect |
| 新增 | `src/app/(app)/notes/feed/page.tsx` | feed 列表頁 |
| 新增 | `src/components/notes/notes-canvas.tsx` | canvas 頁 client 元件（header + editor） |
| 新增 | `src/components/notes/notes-canvas-editor.tsx` | TipTap canvas 編輯器（含拖放） |
| 新增 | `src/components/notes/notes-feed-page.tsx` | feed 頁 client 元件（header + list） |
| 修改 | `src/components/notes/note-feed.tsx` | 重構為純「列表 + 無限捲動」元件（移除今天條目、日誌標題），或整合進 `notes-feed-page.tsx` |
| 修改 | `src/components/notes/note-entry.tsx` | 外層加 `<Link href="/notes/{date}">` 與 hover 樣式 |
| 修改 | `src/hooks/use-notes-feed.ts` | `excludeDate` 參數保留，但 feed page 傳入 today 以排除 |

**注意**：`DailyNotes` 元件（目前被 `NoteFeed` 的今天條目使用）可能不再需要，功能被 `NotesCanvasEditor` 取代。檢查是否還有其他地方引用；若無則刪除。

## 邊界情況

1. **`/notes/[date]` 日期格式非法** → redirect 到 `/notes`
2. **`/notes/[date]` 日期為未來** → 允許（可以預先寫草稿？）。先允許不特別限制
3. **Canvas 編輯器 date prop 變動**（例如由 `/notes` navigate 到 `/notes/2026-04-05`）→ 重新載入內容並重置編輯器
4. **Feed 為空**（新使用者）→ 顯示空狀態 + 回到今天 canvas 的連結
5. **拖放時 content 為空** → 不顯示 drag handle
6. **拖放進行中使用者跳離頁面** → 已儲存的最近內容保留，未完成的拖放不存
7. **TipTap 內的 list / blockquote 等 nested 結構** → 拖放以「最外層區塊」為單位，nested list item 不獨立拖動

## 不在範圍內

- 多筆記 per day（一天仍是一則日記）
- Slash command（`/heading` 等）
- 版本歷史 / undo stack
- 圖片 / 附件上傳
- 連結到其他筆記（`[[wikilink]]`）
- 標籤 / 分類
- 全文搜尋（未來 Feed 頁可考慮）
- 匯出功能

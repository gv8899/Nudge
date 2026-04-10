# 日記頁 Canvas 改版實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/notes` 改為 Notion 風格的 canvas 全畫布編輯器，支援區塊拖放，過往日記移到 `/notes/feed` 獨立頁面

**Architecture:** 拆成三條路由：`/notes`（今天 canvas）、`/notes/[date]`（特定日期 canvas）、`/notes/feed`（時間軸列表）。Canvas 與 feed 之間用右上角 icon 切換。新建 `NotesCanvas`（外層 + header）與 `NotesCanvasEditor`（TipTap 編輯器含拖放），既有 `DailyNotes` 元件不再使用後移除。區塊拖放用 TipTap 的 ProseMirror state 直接操作節點。

**Tech Stack:** Next.js 16, TipTap v3, ProseMirror, date-fns, lucide-react

---

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 新增 | `src/components/notes/notes-canvas-editor.tsx` | TipTap 編輯器（無框、大字級、支援區塊拖放） |
| 新增 | `src/components/notes/notes-canvas.tsx` | Canvas 頁面 wrapper：header + editor |
| 新增 | `src/components/notes/notes-feed-page.tsx` | Feed 頁面 wrapper：header + list |
| 修改 | `src/app/(app)/notes/page.tsx` | 渲染今天的 Canvas |
| 新增 | `src/app/(app)/notes/[date]/page.tsx` | 特定日期 Canvas（today 則 redirect） |
| 新增 | `src/app/(app)/notes/feed/page.tsx` | 渲染 feed 頁 |
| 修改 | `src/components/notes/note-entry.tsx` | 外層改為 `<Link>` 包覆，加 hover |
| 修改 | `src/components/notes/note-feed.tsx` | 移除「今天」特殊條目，改為純列表元件 |
| 修改 | `src/hooks/use-notes-feed.ts` | 保留 excludeDate 參數 |
| 刪除 | `src/components/daily/daily-notes.tsx` | 被 `NotesCanvasEditor` 取代 |

---

### Task 1: NotesCanvasEditor (無拖放先版)

**Files:**
- Create: `src/components/notes/notes-canvas-editor.tsx`

- [ ] **Step 1: 建立 notes-canvas-editor.tsx**

```tsx
"use client";

import { useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

interface NotesCanvasEditorProps {
  date: string;
  initialContent: string;
}

export function NotesCanvasEditor({
  date,
  initialContent,
}: NotesCanvasEditorProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialContent);
  const dateRef = useRef(date);
  const skipUpdateRef = useRef(false);

  dateRef.current = date;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "寫點什麼⋯⋯" }),
    ],
    content: initialContent,
    editable: true,
    onUpdate: ({ editor }) => {
      if (skipUpdateRef.current) return;
      const html = editor.getHTML();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (html === lastSavedRef.current) return;
        lastSavedRef.current = html;
        fetch(`/api/daily/${dateRef.current}/notes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: html }),
        });
      }, 800);
    },
    editorProps: {
      attributes: {
        class: "outline-none",
      },
    },
  });

  // 切換日期時更新內容
  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      skipUpdateRef.current = true;
      editor.commands.setContent(initialContent);
      skipUpdateRef.current = false;
      lastSavedRef.current = initialContent;
    }
  }, [initialContent, date, editor]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!editor) return;
    const target = e.target as HTMLElement;
    if (target.closest(".tiptap")) return;
    editor.commands.focus("start");
  };

  return (
    <div
      onClick={handleContainerClick}
      className="cursor-text min-h-[60vh] notes-canvas-editor"
    >
      <div className="tiptap-container">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/notes/notes-canvas-editor.tsx
git commit -m "feat: NotesCanvasEditor — TipTap canvas 編輯器"
```

---

### Task 2: Canvas 編輯器字級與間距（CSS）

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: 在 globals.css 新增 canvas 編輯器專屬樣式**

在現有 tiptap-container 樣式區段之後新增：

```css
/* Notes canvas editor — 無框、大字級、寬行距 */
.notes-canvas-editor .tiptap-container .tiptap {
  font-size: 1.0625rem;
  line-height: 1.75;
  color: var(--foreground);
}

.notes-canvas-editor .tiptap-container .tiptap p {
  margin: 0.5rem 0;
}

.notes-canvas-editor .tiptap-container .tiptap h1 {
  font-size: 1.75rem;
  line-height: 1.25;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.notes-canvas-editor .tiptap-container .tiptap h2 {
  font-size: 1.375rem;
  line-height: 1.3;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}

.notes-canvas-editor .tiptap-container .tiptap h3 {
  font-size: 1.125rem;
  margin-top: 1rem;
  margin-bottom: 0.25rem;
}

.notes-canvas-editor .tiptap-container .tiptap ul,
.notes-canvas-editor .tiptap-container .tiptap ol {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}

.notes-canvas-editor .tiptap-container .tiptap blockquote {
  border-left: 3px solid var(--primary);
  padding-left: 1rem;
  color: var(--text-dim);
  margin: 0.75rem 0;
  font-style: italic;
}

.notes-canvas-editor .tiptap-container .tiptap p.is-editor-empty:first-child::before {
  color: var(--text-faint);
  font-size: 1.0625rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: notes canvas editor 字級與間距樣式"
```

---

### Task 3: NotesCanvas wrapper（header + editor）

**Files:**
- Create: `src/components/notes/notes-canvas.tsx`

- [ ] **Step 1: 建立 notes-canvas.tsx**

```tsx
"use client";

import Link from "next/link";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { List } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { NotesCanvasEditor } from "./notes-canvas-editor";

interface NotesCanvasProps {
  date: string;
  isToday: boolean;
}

export function NotesCanvas({ date, isToday }: NotesCanvasProps) {
  const { data, isLoading } = useSWR<{ content: string }>(
    `/api/daily/${date}/notes`,
    fetcher
  );

  const d = parseISO(date);
  const dateLabel = format(d, "M/d · EEEE", { locale: zhTW });
  const fullLabel = isToday
    ? `${format(d, "M/d")} · 今天`
    : dateLabel;

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-foreground shrink-0">日誌</h1>
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-sm text-text-dim tabular-nums truncate">
            {fullLabel}
          </span>
          <Link
            href="/notes/feed"
            aria-label="切換到 feed"
            title="切換到 feed"
            className="text-text-dim hover:text-foreground transition-colors p-2 -mr-2 shrink-0"
          >
            <List className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Canvas editor */}
      {isLoading ? (
        <div className="min-h-[60vh] animate-pulse" />
      ) : (
        <NotesCanvasEditor date={date} initialContent={data?.content || ""} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/notes/notes-canvas.tsx
git commit -m "feat: NotesCanvas wrapper — header + editor"
```

---

### Task 4: /notes 路由改為 Canvas

**Files:**
- Modify: `src/app/(app)/notes/page.tsx`

- [ ] **Step 1: 整份替換 notes/page.tsx**

```tsx
import { format } from "date-fns";
import { NotesCanvas } from "@/components/notes/notes-canvas";

export default function NotesPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  return <NotesCanvas date={today} isToday />;
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(app)/notes/page.tsx"
git commit -m "feat: /notes 路由改為今天 canvas"
```

---

### Task 5: /notes/[date] 路由

**Files:**
- Create: `src/app/(app)/notes/[date]/page.tsx`

- [ ] **Step 1: 建立 notes/[date]/page.tsx**

```tsx
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { NotesCanvas } from "@/components/notes/notes-canvas";

export default async function NotesDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  // 驗證格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    redirect("/notes");
  }

  // 若是今天則 redirect 到 /notes 避免 URL 分裂
  const today = format(new Date(), "yyyy-MM-dd");
  if (date === today) {
    redirect("/notes");
  }

  return <NotesCanvas date={date} isToday={false} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(app)/notes/[date]/page.tsx"
git commit -m "feat: /notes/[date] 特定日期 canvas 路由"
```

---

### Task 6: NotesFeedPage 元件（新 feed 頁）

**Files:**
- Create: `src/components/notes/notes-feed-page.tsx`

- [ ] **Step 1: 建立 notes-feed-page.tsx**

```tsx
"use client";

import { useCallback } from "react";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { NoteEntry } from "./note-entry";
import { useNotesFeed } from "@/hooks/use-notes-feed";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";

interface NotesFeedPageProps {
  today: string;
}

export function NotesFeedPage({ today }: NotesFeedPageProps) {
  const { notes, isLoading, isLoadingMore, hasMore, loadMore } =
    useNotesFeed(today);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  const sentinelRef = useIntersectionObserver(handleLoadMore, hasMore);

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">日誌</h1>
        <Link
          href="/notes"
          aria-label="回到今天 canvas"
          title="回到今天"
          className="text-text-dim hover:text-foreground transition-colors p-2 -mr-2"
        >
          <PenLine className="h-5 w-5" />
        </Link>
      </header>

      {/* 時間軸列表 */}
      <div className="relative">
        {isLoading && notes.length === 0 && (
          <p className="text-sm text-text-dim py-8 text-center">載入中...</p>
        )}

        {!isLoading && notes.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-text-dim mb-4">
              還沒有過去的日記。現在先從今天開始寫吧。
            </p>
            <Link
              href="/notes"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <PenLine className="h-4 w-4" />
              去今天的 canvas
            </Link>
          </div>
        )}

        {notes.map((note, i) => (
          <NoteEntry
            key={note.id}
            date={note.date}
            content={note.content}
            isLast={i === notes.length - 1 && !hasMore}
          />
        ))}

        <div ref={sentinelRef} className="pl-16 md:pl-20 py-4 text-center">
          {isLoadingMore && (
            <p className="text-sm text-text-dim">載入更多...</p>
          )}
          {!hasMore && notes.length > 0 && (
            <p className="text-sm text-text-faint">沒有更多日記了</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/notes/notes-feed-page.tsx
git commit -m "feat: NotesFeedPage — 日誌 feed 頁（header + 列表）"
```

---

### Task 7: NoteEntry 改為 Link 可點擊

**Files:**
- Modify: `src/components/notes/note-entry.tsx`

- [ ] **Step 1: 整份替換 note-entry.tsx**

```tsx
"use client";

import Link from "next/link";
import DOMPurify from "dompurify";
import { format, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";

interface NoteEntryProps {
  date: string;
  content: string;
  isLast?: boolean;
}

export function NoteEntry({ date, content, isLast = false }: NoteEntryProps) {
  const d = parseISO(date);
  const dayNum = format(d, "d");
  const month = format(d, "M 月", { locale: zhTW });
  const weekday = format(d, "EEE", { locale: zhTW });
  const ariaLabel = format(d, "yyyy年M月d日的日記", { locale: zhTW });

  const cleanHTML = DOMPurify.sanitize(content);

  return (
    <Link
      href={`/notes/${date}`}
      aria-label={ariaLabel}
      className="block"
    >
      <article className="relative pl-16 md:pl-20 pb-10 group">
        {/* 時間軸 column */}
        <div
          className="absolute left-5 md:left-6 top-0 bottom-0 w-3 flex flex-col items-center pointer-events-none"
          aria-hidden="true"
        >
          <div className="h-[18px] w-px bg-border" />
          <div className="h-3 w-3 rounded-full bg-primary shrink-0" />
          {!isLast && <div className="flex-1 w-px bg-border" />}
        </div>

        {/* Hover 反饋 */}
        <div className="absolute left-12 md:left-14 right-0 top-0 bottom-4 rounded-lg bg-muted/0 group-hover:bg-muted/40 transition-colors pointer-events-none" />

        {/* 日期標題 */}
        <header className="relative flex items-center gap-3 mb-5">
          <span className="text-[2.25rem] font-black text-primary tabular-nums leading-none tracking-tight">
            {dayNum}
          </span>
          <div
            className="self-stretch w-px bg-primary/25 my-1"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1 text-[10px] font-bold tracking-[0.18em] uppercase leading-none">
            <span className="text-foreground/75">{month}</span>
            <span className="text-text-dim">{weekday}</span>
          </div>
        </header>

        {/* 筆記內容 */}
        <div
          className="relative tiptap-container"
          dangerouslySetInnerHTML={{ __html: cleanHTML }}
        />
      </article>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/notes/note-entry.tsx
git commit -m "feat: NoteEntry 整塊可點擊，跳轉到 /notes/[date]"
```

---

### Task 8: /notes/feed 路由

**Files:**
- Create: `src/app/(app)/notes/feed/page.tsx`

- [ ] **Step 1: 建立 notes/feed/page.tsx**

```tsx
import { format } from "date-fns";
import { NotesFeedPage } from "@/components/notes/notes-feed-page";

export default function FeedPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  return <NotesFeedPage today={today} />;
}
```

- [ ] **Step 2: Build 驗證**

```bash
npx next build 2>&1 | tail -10
```
預期：build 成功，出現 `/notes`、`/notes/[date]`、`/notes/feed` 三條路由。

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/notes/feed/page.tsx"
git commit -m "feat: /notes/feed 路由"
```

---

### Task 9: 區塊拖放（Block drag-and-drop）

**Files:**
- Modify: `src/components/notes/notes-canvas-editor.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: 擴充 NotesCanvasEditor 加入 drag handle 邏輯**

整份替換 `src/components/notes/notes-canvas-editor.tsx`：

```tsx
"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { GripVertical } from "lucide-react";

interface NotesCanvasEditorProps {
  date: string;
  initialContent: string;
}

interface BlockInfo {
  pos: number;
  top: number;
  height: number;
}

export function NotesCanvasEditor({
  date,
  initialContent,
}: NotesCanvasEditorProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialContent);
  const dateRef = useRef(date);
  const skipUpdateRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBlock, setHoveredBlock] = useState<BlockInfo | null>(null);
  const [draggingFromPos, setDraggingFromPos] = useState<number | null>(null);

  dateRef.current = date;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "寫點什麼⋯⋯" }),
    ],
    content: initialContent,
    editable: true,
    onUpdate: ({ editor }) => {
      if (skipUpdateRef.current) return;
      const html = editor.getHTML();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (html === lastSavedRef.current) return;
        lastSavedRef.current = html;
        fetch(`/api/daily/${dateRef.current}/notes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: html }),
        });
      }, 800);
    },
    editorProps: {
      attributes: {
        class: "outline-none",
      },
    },
  });

  // 切換日期時更新內容
  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      skipUpdateRef.current = true;
      editor.commands.setContent(initialContent);
      skipUpdateRef.current = false;
      lastSavedRef.current = initialContent;
    }
  }, [initialContent, date, editor]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Hover 偵測：滑鼠移動時找到對應的 top-level block
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!editor || !containerRef.current || draggingFromPos !== null) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseY = e.clientY;

      // 找 top-level blocks
      let found: BlockInfo | null = null;
      editor.state.doc.forEach((node, offset) => {
        const dom = editor.view.nodeDOM(offset);
        if (!dom || !(dom instanceof HTMLElement)) return;
        const rect = dom.getBoundingClientRect();
        if (mouseY >= rect.top && mouseY <= rect.bottom) {
          found = {
            pos: offset,
            top: rect.top - containerRect.top,
            height: rect.height,
          };
        }
      });
      setHoveredBlock(found);
    },
    [editor, draggingFromPos]
  );

  const handleMouseLeave = () => {
    if (draggingFromPos === null) setHoveredBlock(null);
  };

  // 拖放事件
  const handleDragStart = (e: React.DragEvent, pos: number) => {
    setDraggingFromPos(pos);
    e.dataTransfer.effectAllowed = "move";
    // 設一個空的 drag image 避免整個區塊變成 ghost
    const img = new Image();
    img.src =
      "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (draggingFromPos === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!editor || draggingFromPos === null) return;
    e.preventDefault();

    // 找到目標 block（滑鼠放開位置下方最近的 block）
    let targetPos: number | null = null;
    editor.state.doc.forEach((node, offset) => {
      const dom = editor.view.nodeDOM(offset);
      if (!dom || !(dom instanceof HTMLElement)) return;
      const rect = dom.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2 && targetPos === null) {
        targetPos = offset;
      }
    });
    if (targetPos === null) {
      // 放到最後一個 block 之後
      targetPos = editor.state.doc.content.size;
    }

    if (targetPos === draggingFromPos) {
      setDraggingFromPos(null);
      return;
    }

    // 用 ProseMirror transaction 移動節點
    const { state } = editor;
    const sourceNode = state.doc.nodeAt(draggingFromPos);
    if (!sourceNode) {
      setDraggingFromPos(null);
      return;
    }

    const sourceEnd = draggingFromPos + sourceNode.nodeSize;
    const tr = state.tr;
    const sliceCopy = sourceNode.copy(sourceNode.content);

    // 先刪除來源
    tr.delete(draggingFromPos, sourceEnd);

    // 調整 target 位置：若 target 在 source 之後，刪除後位置需減去 source 大小
    let adjustedTarget = targetPos;
    if (targetPos > draggingFromPos) {
      adjustedTarget = targetPos - sourceNode.nodeSize;
    }

    tr.insert(adjustedTarget, sliceCopy);
    editor.view.dispatch(tr);

    setDraggingFromPos(null);
    setHoveredBlock(null);
  };

  const handleDragEnd = () => {
    setDraggingFromPos(null);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!editor) return;
    const target = e.target as HTMLElement;
    if (target.closest(".tiptap")) return;
    if (target.closest("[data-drag-handle]")) return;
    editor.commands.focus("start");
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative cursor-text min-h-[60vh] notes-canvas-editor"
    >
      {/* Drag handle overlay */}
      {hoveredBlock && (
        <button
          type="button"
          draggable
          data-drag-handle
          onDragStart={(e) => handleDragStart(e, hoveredBlock.pos)}
          onDragEnd={handleDragEnd}
          className="absolute -left-8 flex items-center justify-center w-6 h-6 rounded text-text-faint hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing transition-colors"
          style={{
            top: hoveredBlock.top + hoveredBlock.height / 2 - 12,
          }}
          aria-label="拖動區塊"
          title="拖動以重新排序"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <div className="tiptap-container">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 新增 drag placeholder 樣式到 globals.css**

在 `/* Notes canvas editor */` 區段之後新增：

```css
/* Drag-in-progress 樣式 */
.notes-canvas-editor.dragging .tiptap > * {
  pointer-events: none;
}
```

- [ ] **Step 3: Build 驗證**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/components/notes/notes-canvas-editor.tsx src/app/globals.css
git commit -m "feat: notes canvas editor 支援區塊拖放"
```

---

### Task 10: 刪除不再使用的檔案 + 舊 NoteFeed 清理

**Files:**
- Delete: `src/components/daily/daily-notes.tsx`
- Delete: `src/components/notes/note-feed.tsx`

`NotesFeedPage` 已取代 `NoteFeed`，`NotesCanvasEditor` 已取代 `DailyNotes`。

- [ ] **Step 1: 確認沒有其他地方引用**

```bash
# 預期：只有 note-feed.tsx 自己的 export
grep -rn "NoteFeed" src/ | grep -v "note-feed.tsx\|notes-feed-page\|use-notes-feed"
# 預期無輸出

grep -rn "DailyNotes" src/ | grep -v "daily-notes.tsx"
# 預期無輸出
```

- [ ] **Step 2: 刪除檔案**

```bash
rm src/components/daily/daily-notes.tsx
rm src/components/notes/note-feed.tsx
```

- [ ] **Step 3: Build 驗證**

```bash
npx next build 2>&1 | tail -10
```
預期：build 成功。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: 移除被取代的 DailyNotes 與 NoteFeed"
```

---

### Task 11: 驗證

- [ ] **Step 1: 啟動 dev server**

```bash
npm run dev
```

- [ ] **Step 2: 測試路由**

1. **`/notes`** → 今天 canvas（日誌 + 日期 + 右上 list icon + 無框編輯器）
2. 點右上 list icon → 到 `/notes/feed`
3. **`/notes/feed`** → 日誌 + 右上 PenLine icon + 時間軸列表
4. 點 feed 中任一 entry → 進入 `/notes/2026-04-XX`
5. **`/notes/2026-04-XX`** → 該日 canvas（日期 = 4/XX），右上 list icon 回 feed
6. **`/notes/2026-04-10`**（今天）→ 自動 redirect 到 `/notes`
7. **`/notes/invalid`** → redirect 到 `/notes`

- [ ] **Step 3: 測試編輯器**

1. 在 canvas 輸入文字，800ms 後自動儲存
2. 重新整理後內容仍在
3. 切到 feed 再切回 canvas，內容還在
4. 從 feed 進入 `/notes/[past-date]`，編輯過去日期，儲存後 feed 顯示更新

- [ ] **Step 4: 測試區塊拖放**

1. Canvas 輸入多段文字（至少 3 個段落）
2. Hover 段落時左側出現 GripVertical icon
3. 按住 icon 拖動到另一段上方 → 順序交換
4. 拖動 heading / list 也能正常運作
5. 拖放後內容自動儲存
6. Empty state（完全沒內容）時不顯示 drag handle

- [ ] **Step 5: 測試空狀態**

清空資料庫所有 dailyNotes 後，到 `/notes/feed` 應該顯示「還沒有過去的日記」+ 回今天的連結。

- [ ] **Step 6: 最終 commit（如有微調）**

```bash
git add -A
git commit -m "fix: notes canvas 改版微調"
```

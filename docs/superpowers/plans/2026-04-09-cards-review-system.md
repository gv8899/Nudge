# 卡片回顧系統實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/cards` 列表頁與 `/cards/[id]` 詳細頁，讓有 description 的任務可以瀏覽、搜尋、回顧

**Architecture:** Card 不是新 entity，是「`description != ''` 且 `status != 'archived'`」的 task 的 view。新增 `/api/cards` 提供分頁 + 搜尋；前端用 SWR infinite scroll 仿 `useNotesFeed`；list / grid 兩種 view 切換並存於 localStorage。詳細頁 reuse 既有 `GET /api/tasks/[id]`。

**Tech Stack:** Next.js 16, Drizzle ORM, SWR Infinite, Tailwind v4, lucide icons

---

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 新增 | `src/lib/strip-html.ts` | HTML → 純文字（給卡片預覽用） |
| 新增 | `src/app/api/cards/route.ts` | GET 列表 API（分頁 + 搜尋） |
| 新增 | `src/hooks/use-cards-feed.ts` | SWR Infinite hook |
| 新增 | `src/components/cards/card-list-item.tsx` | List view 單張卡片 |
| 新增 | `src/components/cards/card-grid-item.tsx` | Grid view 單張卡片 |
| 新增 | `src/components/cards/cards-feed.tsx` | client：搜尋 + view 切換 + 無限捲動 |
| 新增 | `src/app/(app)/cards/page.tsx` | 列表頁 (server) |
| 新增 | `src/app/(app)/cards/[id]/page.tsx` | 詳細頁 (server) |
| 新增 | `src/components/cards/card-detail.tsx` | 詳細頁 client 元件 |
| 修改 | `src/components/sidebar/app-sidebar.tsx` | 加入 Cards nav item |

---

### Task 1: strip-html 工具

**Files:**
- Create: `src/lib/strip-html.ts`

- [ ] **Step 1: 建立 strip-html.ts**

```ts
/**
 * 把 HTML 字串轉為純文字，給卡片預覽顯示用。
 * 不負責 XSS 防護 — 結果只用在 textContent，不會 dangerouslySetInnerHTML。
 *
 * @param html  原始 HTML 字串
 * @param maxLength  截斷長度（含省略號），undefined 表示不截斷
 */
export function stripHtml(html: string, maxLength?: number): string {
  if (!html) return "";
  // 移除 tag
  let text = html.replace(/<[^>]*>/g, " ");
  // decode 常見 entity
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // 壓縮連續空白
  text = text.replace(/\s+/g, " ").trim();
  if (maxLength && text.length > maxLength) {
    return text.slice(0, maxLength).trimEnd() + "…";
  }
  return text;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/strip-html.ts
git commit -m "feat: 新增 strip-html 工具用於卡片預覽"
```

---

### Task 2: GET /api/cards endpoint

**Files:**
- Create: `src/app/api/cards/route.ts`

- [ ] **Step 1: 建立 endpoint**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { and, eq, ne, lt, desc, or, like } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import { stripHtml } from "@/lib/strip-html";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const cursor = searchParams.get("cursor") || "9999-12-31T23:59:59.999Z";
  const limit = Math.min(Number(searchParams.get("limit") || "20"), 50);

  const conditions = [
    eq(tasks.userId, user.id),
    ne(tasks.description, ""),
    ne(tasks.status, "archived"),
    lt(tasks.updatedAt, cursor),
  ];

  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(like(tasks.title, pattern), like(tasks.description, pattern))!
    );
  }

  const rows = db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.updatedAt))
    .limit(limit + 1)
    .all();

  // 過濾 description strip 後是空白的（例如 <p></p>）
  const filtered = rows.filter(
    (r) => r.description && stripHtml(r.description).length > 0
  );

  const hasMore = filtered.length > limit;
  const cards = hasMore ? filtered.slice(0, limit) : filtered;
  const nextCursor = hasMore ? cards[cards.length - 1].updatedAt : null;

  return NextResponse.json({ cards, nextCursor });
}
```

- [ ] **Step 2: 手動測試**

開啟瀏覽器訪問 `http://localhost:3000/api/cards`（已登入），確認回傳 `{ cards: [...], nextCursor: ... }`，且 cards 內的任務都有 description。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cards/route.ts
git commit -m "feat: 新增 GET /api/cards 列表 API（分頁 + 搜尋）"
```

---

### Task 3: useCardsFeed hook

**Files:**
- Create: `src/hooks/use-cards-feed.ts`

- [ ] **Step 1: 建立 hook**

```ts
import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/fetcher";
import type { TaskStatus } from "@/lib/constants";

export interface CardItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface CardsPage {
  cards: CardItem[];
  nextCursor: string | null;
}

export function useCardsFeed(query: string) {
  const getKey = (pageIndex: number, prev: CardsPage | null) => {
    if (prev && !prev.nextCursor) return null;
    const cursor = prev ? prev.nextCursor : undefined;
    const params = new URLSearchParams({ limit: "20" });
    if (cursor) params.set("cursor", cursor);
    if (query) params.set("q", query);
    return `/api/cards?${params.toString()}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<CardsPage>(getKey, fetcher, {
      revalidateFirstPage: false,
    });

  const cards = data ? data.flatMap((page) => page.cards) : [];
  const hasMore = data ? data[data.length - 1]?.nextCursor !== null : false;
  const isLoadingMore =
    isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");

  return {
    cards,
    isLoading,
    isLoadingMore: !!isLoadingMore,
    isValidating,
    hasMore,
    loadMore: () => setSize(size + 1),
    mutate,
    error,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-cards-feed.ts
git commit -m "feat: 新增 useCardsFeed SWR infinite hook"
```

---

### Task 4: List 與 Grid 卡片元件

**Files:**
- Create: `src/components/cards/card-list-item.tsx`
- Create: `src/components/cards/card-grid-item.tsx`

- [ ] **Step 1: 建立 card-list-item.tsx**

```tsx
"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { stripHtml } from "@/lib/strip-html";
import { TASK_STATUSES, type TaskStatus } from "@/lib/constants";
import type { CardItem } from "@/hooks/use-cards-feed";

interface CardListItemProps {
  card: CardItem;
}

export function CardListItem({ card }: CardListItemProps) {
  const preview = stripHtml(card.description, 150);
  const status = TASK_STATUSES[card.status as TaskStatus];
  const updated = format(parseISO(card.updatedAt), "M/d");

  return (
    <Link
      href={`/cards/${card.id}`}
      className="block py-4 px-2 -mx-2 rounded-lg hover:bg-muted transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {card.title}
          </h3>
          <p className="mt-1 text-xs text-text-dim line-clamp-2">{preview}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-xs text-text-dim tabular-nums">{updated}</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded border"
            style={{
              color: status.color,
              borderColor: status.color,
              backgroundColor: status.bgColor,
            }}
          >
            {status.label}
          </span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: 建立 card-grid-item.tsx**

```tsx
"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { stripHtml } from "@/lib/strip-html";
import { TASK_STATUSES, type TaskStatus } from "@/lib/constants";
import type { CardItem } from "@/hooks/use-cards-feed";

interface CardGridItemProps {
  card: CardItem;
}

export function CardGridItem({ card }: CardGridItemProps) {
  const preview = stripHtml(card.description, 120);
  const status = TASK_STATUSES[card.status as TaskStatus];
  const updated = format(parseISO(card.updatedAt), "M/d");

  return (
    <Link
      href={`/cards/${card.id}`}
      className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card hover:border-border-light transition-colors h-full"
    >
      <h3 className="text-sm font-semibold text-foreground line-clamp-2">
        {card.title}
      </h3>
      <p className="text-xs text-text-dim line-clamp-4 flex-1">{preview}</p>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        <span className="text-xs text-text-dim tabular-nums">{updated}</span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded border"
          style={{
            color: status.color,
            borderColor: status.color,
            backgroundColor: status.bgColor,
          }}
        >
          {status.label}
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/card-list-item.tsx src/components/cards/card-grid-item.tsx
git commit -m "feat: 新增卡片 list 與 grid item 元件"
```

---

### Task 5: CardsFeed client 元件

**Files:**
- Create: `src/components/cards/cards-feed.tsx`

- [ ] **Step 1: 建立 cards-feed.tsx**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, List, LayoutGrid } from "lucide-react";
import { useCardsFeed } from "@/hooks/use-cards-feed";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { CardListItem } from "./card-list-item";
import { CardGridItem } from "./card-grid-item";

type View = "list" | "grid";
const VIEW_STORAGE_KEY = "nudge:cards-view";

export function CardsFeed() {
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // 載入 view 偏好
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as View | null;
    if (stored === "list" || stored === "grid") setView(stored);
  }, []);

  const handleViewChange = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {}
  };

  // debounce 搜尋
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { cards, isLoading, isLoadingMore, hasMore, loadMore } =
    useCardsFeed(debouncedQuery);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) loadMore();
  }, [isLoadingMore, hasMore, loadMore]);

  const sentinelRef = useIntersectionObserver(handleLoadMore, hasMore);

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6">
      {/* 標題 + view 切換 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">卡片</h1>
        <div className="flex items-center gap-1 border border-border rounded-lg p-1">
          <button
            onClick={() => handleViewChange("list")}
            aria-label="列表檢視"
            aria-pressed={view === "list"}
            className={`p-1.5 rounded transition-colors ${
              view === "list"
                ? "bg-muted text-foreground"
                : "text-text-dim hover:text-foreground"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleViewChange("grid")}
            aria-label="網格檢視"
            aria-pressed={view === "grid"}
            className={`p-1.5 rounded transition-colors ${
              view === "grid"
                ? "bg-muted text-foreground"
                : "text-text-dim hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 搜尋框 */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋卡片..."
          className="w-full pl-10 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-text-faint focus:outline-none focus:border-primary transition-colors"
          aria-label="搜尋卡片"
        />
      </div>

      {/* 卡片內容 */}
      {isLoading && cards.length === 0 ? (
        <p className="text-sm text-text-dim text-center py-8">載入中...</p>
      ) : cards.length === 0 ? (
        <p className="text-sm text-text-dim text-center py-8">
          {debouncedQuery ? "沒有符合的卡片" : "還沒有寫過內容的任務"}
        </p>
      ) : view === "list" ? (
        <div className="divide-y divide-border">
          {cards.map((c) => (
            <CardListItem key={c.id} card={c} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <CardGridItem key={c.id} card={c} />
          ))}
        </div>
      )}

      {/* 無限捲動觸發器 */}
      <div ref={sentinelRef} className="py-4 text-center">
        {isLoadingMore && (
          <p className="text-sm text-text-dim">載入更多...</p>
        )}
        {!hasMore && cards.length > 0 && (
          <p className="text-sm text-text-faint">沒有更多卡片了</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cards/cards-feed.tsx
git commit -m "feat: 新增 cards-feed 元件（搜尋 + view 切換 + 無限捲動）"
```

---

### Task 6: /cards 列表頁

**Files:**
- Create: `src/app/(app)/cards/page.tsx`

- [ ] **Step 1: 建立 page.tsx**

```tsx
import { CardsFeed } from "@/components/cards/cards-feed";

export default function CardsPage() {
  return <CardsFeed />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/cards/page.tsx
git commit -m "feat: 新增 /cards 列表頁路由"
```

---

### Task 7: /cards/[id] 詳細頁

**Files:**
- Create: `src/components/cards/card-detail.tsx`
- Create: `src/app/(app)/cards/[id]/page.tsx`

- [ ] **Step 1: 建立 card-detail.tsx**

```tsx
"use client";

import Link from "next/link";
import useSWR from "swr";
import DOMPurify from "dompurify";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { TASK_STATUSES, type TaskStatus } from "@/lib/constants";

interface CardDetailProps {
  id: string;
}

interface CardData {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export function CardDetail({ id }: CardDetailProps) {
  const { data, error, isLoading } = useSWR<CardData>(
    `/api/tasks/${id}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-8">
        <p className="text-sm text-text-dim">載入中...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-8">
        <Link
          href="/cards"
          className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> 返回卡片
        </Link>
        <p className="text-sm text-destructive">找不到這張卡片</p>
      </div>
    );
  }

  const status = TASK_STATUSES[data.status];
  const cleanHTML = data.description ? DOMPurify.sanitize(data.description) : "";

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-8">
      <Link
        href="/cards"
        className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> 返回卡片
      </Link>

      <header className="mb-6 pb-4 border-b border-border">
        <h1 className="text-3xl font-bold text-foreground tracking-tight mb-3">
          {data.title}
        </h1>
        <div className="flex items-center gap-3 text-xs text-text-dim">
          <span>建立 {format(parseISO(data.createdAt), "yyyy/MM/dd")}</span>
          <span>·</span>
          <span>更新 {format(parseISO(data.updatedAt), "yyyy/MM/dd")}</span>
          <span>·</span>
          <span
            className="px-1.5 py-0.5 rounded border text-[10px]"
            style={{
              color: status.color,
              borderColor: status.color,
              backgroundColor: status.bgColor,
            }}
          >
            {status.label}
          </span>
        </div>
      </header>

      {cleanHTML ? (
        <div
          className="tiptap-container"
          dangerouslySetInnerHTML={{ __html: cleanHTML }}
        />
      ) : (
        <p className="text-sm text-text-dim italic">這張卡片沒有內容</p>
      )}

      {/* 未來：backlinks 區塊 */}
    </div>
  );
}
```

- [ ] **Step 2: 建立 page.tsx**

```tsx
import { CardDetail } from "@/components/cards/card-detail";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CardDetail id={id} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/card-detail.tsx "src/app/(app)/cards/[id]/page.tsx"
git commit -m "feat: 新增 /cards/[id] 詳細頁"
```

---

### Task 8: Sidebar 加入 Cards nav item

**Files:**
- Modify: `src/components/sidebar/app-sidebar.tsx`

- [ ] **Step 1: 加入 Cards 到 navItems**

打開 `src/components/sidebar/app-sidebar.tsx`，找到 import 行：

```tsx
import { CheckSquare, NotebookPen, Settings } from "lucide-react";
```

改為：

```tsx
import { CheckSquare, NotebookPen, BookOpen, Settings } from "lucide-react";
```

然後找到 `navItems` 陣列：

```tsx
const navItems = [
  {
    href: "/",
    match: "/day/",
    icon: CheckSquare,
    label: "Tasks",
  },
  {
    href: "/notes",
    match: "/notes",
    icon: NotebookPen,
    label: "Notes",
  },
];
```

替換為：

```tsx
const navItems = [
  {
    href: "/",
    match: "/day/",
    icon: CheckSquare,
    label: "Tasks",
  },
  {
    href: "/notes",
    match: "/notes",
    icon: NotebookPen,
    label: "Notes",
  },
  {
    href: "/cards",
    match: "/cards",
    icon: BookOpen,
    label: "Cards",
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sidebar/app-sidebar.tsx
git commit -m "feat: sidebar 加入 Cards nav item"
```

---

### Task 9: 驗證

- [ ] **Step 1: Build 通過**

```bash
npx next build 2>&1 | tail -10
```

預期：build 成功。

- [ ] **Step 2: 啟動 dev server，測試**

```bash
npm run dev
```

確認以下：
1. **Sidebar**：左下出現 Cards icon (BookOpen)，mobile bottom bar 也有
2. **/cards 列表頁**：
   - 顯示有 description 的任務
   - 預設 list view
   - 點 grid icon → 切換為 grid view，刷新後仍記住
   - 預覽顯示純文字（無 HTML tag）
3. **搜尋**：輸入關鍵字（標題或內文）→ 列表過濾，無結果顯示「沒有符合的卡片」
4. **無限捲動**：捲到底部自動載入下一批
5. **點擊卡片** → 跳到 `/cards/[id]` 詳細頁
6. **詳細頁**：
   - 顯示完整 description（HTML render）
   - 「← 返回卡片」可回到列表
   - 不存在的 id → 顯示「找不到這張卡片」
7. **空狀態**：清除資料庫所有 description 後，列表頁顯示「還沒有寫過內容的任務」

- [ ] **Step 3: 最終 commit（如有微調）**

```bash
git add -A
git commit -m "fix: 卡片系統微調"
```

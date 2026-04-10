# 卡片看板 View + Tag 系統實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/cards` 頁新增看板 view（每個 tag 一個 column），並建立完整的 tag CRUD + 指派系統

**Architecture:** DB 已有 tags / task_tags 表，需加 sortOrder 欄位。新增 tag CRUD API、task-tag 關聯 API，修改 cards API 帶回 tag 資料。前端新增看板元件（用 @dnd-kit 拖移）、tag picker popover、tag badge、settings 標籤管理。

**Tech Stack:** Next.js 16, Drizzle ORM, SQLite, SWR, @dnd-kit, Tailwind v4, lucide icons

---

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
| 新增 | `src/hooks/use-tags.ts` | SWR hook for tags |
| 修改 | `src/hooks/use-cards-feed.ts` | CardItem type 加 tags |
| 新增 | `src/components/tags/tag-badge.tsx` | Tag 小標籤顯示 |
| 新增 | `src/components/tags/tag-color-picker.tsx` | 色盤選擇元件 |
| 新增 | `src/components/tags/tag-picker.tsx` | Tag 選取 popover |
| 新增 | `src/components/tags/tag-manager.tsx` | Settings 內的標籤管理 |
| 新增 | `src/components/cards/cards-kanban.tsx` | 看板 view |
| 修改 | `src/components/cards/cards-feed.tsx` | 新增 kanban view 切換 |
| 修改 | `src/components/cards/card-list-item.tsx` | 顯示 tag badge |
| 修改 | `src/components/cards/card-grid-item.tsx` | 顯示 tag badge |
| 修改 | `src/components/cards/card-detail.tsx` | 加入 tag picker |
| 修改 | `src/components/task/task-detail-modal.tsx` | 加入 tag picker |
| 修改 | `src/components/settings/settings-modal.tsx` | 新增標籤管理 section |

---

### Task 1: DB schema + constants

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/index.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: 修改 Drizzle schema — tags 加 sortOrder，color 改預設值**

打開 `src/lib/db/schema.ts`，找到 tags 定義：

```ts
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6b7280"),
});
```

替換為：

```ts
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("chart-1"),
  sortOrder: integer("sort_order").notNull().default(0),
});
```

- [ ] **Step 2: 修改 initTables — tags 表加 sort_order**

打開 `src/lib/db/index.ts`，找到 tags 的 CREATE TABLE：

```sql
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280'
);
```

替換為：

```sql
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'chart-1',
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

因為用的是 `CREATE TABLE IF NOT EXISTS`，既有的 DB 不會自動加欄位。在 `initTables` 函式的最後、`}` 之前加：

```ts
// 增量 migration：確保 tags 表有 sort_order 欄位
try {
  sqlite.exec(`ALTER TABLE tags ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
} catch {
  // 欄位已存在，忽略
}
// 增量 migration：color 欄位從 hex 改為 token（更新舊資料）
sqlite.exec(`UPDATE tags SET color = 'chart-1' WHERE color LIKE '#%'`);
```

- [ ] **Step 3: 新增 TAG_COLORS 到 constants.ts**

打開 `src/lib/constants.ts`，在檔案最底部加：

```ts
export const TAG_COLORS = [
  { value: "chart-1", label: "灰藍" },
  { value: "chart-2", label: "琥珀" },
  { value: "chart-3", label: "橄欖" },
  { value: "chart-4", label: "紫藤" },
  { value: "chart-5", label: "赭紅" },
  { value: "primary", label: "主色" },
  { value: "status-waiting", label: "藏青" },
  { value: "status-in-progress", label: "天藍" },
] as const;

export type TagColor = (typeof TAG_COLORS)[number]["value"];
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/index.ts src/lib/constants.ts
git commit -m "feat: tags schema 加 sortOrder、color token 化、TAG_COLORS 色盤"
```

---

### Task 2: Tag CRUD API

**Files:**
- Create: `src/app/api/tags/route.ts`
- Create: `src/app/api/tags/[id]/route.ts`

- [ ] **Step 1: 建立 GET + POST /api/tags**

建立 `src/app/api/tags/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { eq, asc, max } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import { nanoid } from "nanoid";

export async function GET() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = db
    .select()
    .from(tags)
    .where(eq(tags.userId, user.id))
    .orderBy(asc(tags.sortOrder))
    .all();

  return NextResponse.json({ tags: rows });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = (body.name || "").trim();
  if (!name)
    return NextResponse.json({ error: "name required" }, { status: 400 });

  // sortOrder = 目前最大值 + 1
  const maxRow = db
    .select({ maxSort: max(tags.sortOrder) })
    .from(tags)
    .where(eq(tags.userId, user.id))
    .get();
  const nextSort = (maxRow?.maxSort ?? -1) + 1;

  const tag = {
    id: nanoid(),
    userId: user.id,
    name,
    color: body.color || "chart-1",
    sortOrder: nextSort,
  };

  db.insert(tags).values(tag).run();

  return NextResponse.json(tag, { status: 201 });
}
```

- [ ] **Step 2: 建立 PATCH + DELETE /api/tags/[id]**

建立 `src/app/api/tags/[id]/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const existing = db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, user.id)))
    .get();

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.color !== undefined) updates.color = body.color;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

  if (Object.keys(updates).length > 0) {
    db.update(tags)
      .set(updates)
      .where(eq(tags.id, id))
      .run();
  }

  const updated = db.select().from(tags).where(eq(tags.id, id)).get();
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, user.id)))
    .get();

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.delete(tags).where(eq(tags.id, id)).run();

  return NextResponse.json({ deleted: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tags/route.ts src/app/api/tags/\[id\]/route.ts
git commit -m "feat: tag CRUD API（GET/POST/PATCH/DELETE）"
```

---

### Task 3: Task-Tag 關聯 API + Cards API 修改

**Files:**
- Create: `src/app/api/tasks/[id]/tags/route.ts`
- Modify: `src/app/api/cards/route.ts`

- [ ] **Step 1: 建立 PUT /api/tasks/[id]/tags**

建立 `src/app/api/tasks/[id]/tags/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, taskTags } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // 驗證 task 歸屬
  const task = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
    .get();

  if (!task)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const tagIds: string[] = body.tagIds || [];

  // 整批覆蓋：先刪再插
  db.delete(taskTags).where(eq(taskTags.taskId, id)).run();

  for (const tagId of tagIds) {
    db.insert(taskTags).values({ taskId: id, tagId }).run();
  }

  return NextResponse.json({ tagIds });
}
```

- [ ] **Step 2: 修改 GET /api/cards — 回傳帶 tags 的卡片**

打開 `src/app/api/cards/route.ts`，在頂部 import 加入：

```ts
import { tags, taskTags } from "@/lib/db/schema";
import { eq as eqOp } from "drizzle-orm";
```

注意：檔案已經 import 了 `eq`，所以用別名 `eqOp` 或直接 reuse 既有的 `eq`。實際上直接用既有的 `eq` 就好，不需要別名。

在 `return NextResponse.json({ cards, nextCursor });` 之前，加入 tag 查詢，將整個回傳替換為：

```ts
  // 為每張卡片查詢 tags
  const cardsWithTags = cards.map((card) => {
    const cardTags = db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
      })
      .from(taskTags)
      .innerJoin(tags, eq(tags.id, taskTags.tagId))
      .where(eq(taskTags.taskId, card.id))
      .all();

    return { ...card, tags: cardTags };
  });

  return NextResponse.json({ cards: cardsWithTags, nextCursor });
```

同時在頂部 import 加入 `tags, taskTags`：

```ts
import { tasks, tags, taskTags } from "@/lib/db/schema";
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tasks/\[id\]/tags/route.ts src/app/api/cards/route.ts
git commit -m "feat: task-tag 關聯 API + cards API 回傳 tag 資料"
```

---

### Task 4: useTags hook + CardItem type 更新

**Files:**
- Create: `src/hooks/use-tags.ts`
- Modify: `src/hooks/use-cards-feed.ts`

- [ ] **Step 1: 建立 useTags hook**

建立 `src/hooks/use-tags.ts`：

```ts
"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export interface Tag {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

interface TagsResponse {
  tags: Tag[];
}

export function useTags() {
  const { data, error, isLoading, mutate } = useSWR<TagsResponse>(
    "/api/tags",
    fetcher
  );

  return {
    tags: data?.tags || [],
    isLoading,
    error,
    mutate,
  };
}
```

- [ ] **Step 2: CardItem type 加 tags**

打開 `src/hooks/use-cards-feed.ts`，修改 `CardItem` interface：

```ts
export interface CardItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  tags: Array<{ id: string; name: string; color: string }>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-tags.ts src/hooks/use-cards-feed.ts
git commit -m "feat: useTags hook + CardItem type 加 tags 欄位"
```

---

### Task 5: TagBadge + TagColorPicker 元件

**Files:**
- Create: `src/components/tags/tag-badge.tsx`
- Create: `src/components/tags/tag-color-picker.tsx`

- [ ] **Step 1: 建立 tag-badge.tsx**

```bash
mkdir -p src/components/tags
```

建立 `src/components/tags/tag-badge.tsx`：

```tsx
"use client";

interface TagBadgeProps {
  name: string;
  color: string;
  onRemove?: () => void;
}

export function TagBadge({ name, color, onRemove }: TagBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded"
      style={{
        color: `var(--${color})`,
        backgroundColor: `color-mix(in srgb, var(--${color}) 15%, transparent)`,
      }}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-70 transition-opacity leading-none"
          aria-label={`移除 ${name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
```

- [ ] **Step 2: 建立 tag-color-picker.tsx**

建立 `src/components/tags/tag-color-picker.tsx`：

```tsx
"use client";

import { TAG_COLORS, type TagColor } from "@/lib/constants";

interface TagColorPickerProps {
  value: string;
  onChange: (color: TagColor) => void;
}

export function TagColorPicker({ value, onChange }: TagColorPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-2 p-2">
      {TAG_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          title={c.label}
          aria-label={c.label}
          aria-pressed={value === c.value}
          className={`w-7 h-7 rounded-full border-2 transition-colors ${
            value === c.value
              ? "border-foreground scale-110"
              : "border-transparent hover:border-muted-foreground"
          }`}
          style={{ backgroundColor: `var(--${c.value})` }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tags/tag-badge.tsx src/components/tags/tag-color-picker.tsx
git commit -m "feat: TagBadge + TagColorPicker 元件"
```

---

### Task 6: TagPicker popover

**Files:**
- Create: `src/components/tags/tag-picker.tsx`

- [ ] **Step 1: 建立 tag-picker.tsx**

建立 `src/components/tags/tag-picker.tsx`：

```tsx
"use client";

import { useState } from "react";
import { Tag as TagIcon, Plus } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useTags, type Tag } from "@/hooks/use-tags";
import { TagBadge } from "./tag-badge";
import { TagColorPicker } from "./tag-color-picker";
import type { TagColor } from "@/lib/constants";

interface TagPickerProps {
  taskId: string;
  selectedTags: Array<{ id: string; name: string; color: string }>;
  onTagsChange: (tagIds: string[]) => void;
}

export function TagPicker({ taskId, selectedTags, onTagsChange }: TagPickerProps) {
  const { tags: allTags, mutate: mutateTags } = useTags();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [creatingName, setCreatingName] = useState<string | null>(null);
  const [newColor, setNewColor] = useState<TagColor>("chart-1");

  const selectedIds = new Set(selectedTags.map((t) => t.id));

  const filtered = allTags.filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = allTags.some(
    (t) => t.name.toLowerCase() === search.toLowerCase()
  );

  const toggleTag = (tagId: string) => {
    const newIds = selectedIds.has(tagId)
      ? [...selectedIds].filter((id) => id !== tagId)
      : [...selectedIds, tagId];
    onTagsChange(newIds);
  };

  const createTag = async () => {
    const name = creatingName || search.trim();
    if (!name) return;

    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: newColor }),
    });

    if (!res.ok) return;
    const tag = await res.json();
    mutateTags();

    // 自動選取新建的 tag
    onTagsChange([...selectedIds, tag.id]);
    setSearch("");
    setCreatingName(null);
    setNewColor("chart-1");
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {selectedTags.map((t) => (
        <TagBadge
          key={t.id}
          name={t.name}
          color={t.color}
          onRemove={() => toggleTag(t.id)}
        />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="inline-flex items-center gap-1 text-xs text-text-dim hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted cursor-pointer"
          aria-label="新增標籤"
        >
          <TagIcon className="h-3 w-3" />
          <Plus className="h-3 w-3" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          {creatingName !== null ? (
            /* 建立新 tag 模式 */
            <div className="p-3 space-y-3">
              <div className="text-xs font-medium text-foreground">
                建立「{creatingName}」
              </div>
              <TagColorPicker value={newColor} onChange={setNewColor} />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreatingName(null)}
                  className="text-xs text-text-dim hover:text-foreground transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={createTag}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  建立
                </button>
              </div>
            </div>
          ) : (
            /* 搜尋 + 選取模式 */
            <div>
              <div className="p-2 border-b border-border">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜尋或建立標籤..."
                  className="w-full text-sm bg-transparent outline-none placeholder:text-text-faint text-foreground"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {filtered.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: `var(--${tag.color})` }}
                    />
                    <span className="flex-1 truncate text-foreground">{tag.name}</span>
                    {selectedIds.has(tag.id) && (
                      <span className="text-primary text-xs">✓</span>
                    )}
                  </button>
                ))}
                {search.trim() && !exactMatch && (
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingName(search.trim());
                    }}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors text-primary"
                  >
                    <Plus className="h-3 w-3" />
                    建立「{search.trim()}」
                  </button>
                )}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tags/tag-picker.tsx
git commit -m "feat: TagPicker popover（搜尋、多選、新增 tag）"
```

---

### Task 7: Tag 管理（Settings modal）

**Files:**
- Create: `src/components/tags/tag-manager.tsx`
- Modify: `src/components/settings/settings-modal.tsx`

- [ ] **Step 1: 建立 tag-manager.tsx**

建立 `src/components/tags/tag-manager.tsx`：

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Trash2, GripVertical } from "lucide-react";
import { useTags, type Tag } from "@/hooks/use-tags";
import { TagColorPicker } from "./tag-color-picker";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { TagColor } from "@/lib/constants";

export function TagManager() {
  const { tags, mutate } = useTags();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const createTag = async () => {
    const name = newName.trim();
    if (!name) return;
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewName("");
    mutate();
  };

  const updateTag = async (id: string, updates: { name?: string; color?: TagColor }) => {
    await fetch(`/api/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    mutate();
  };

  const deleteTag = async (id: string) => {
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
    mutate();
  };

  const saveEdit = (id: string) => {
    const name = editingName.trim();
    if (name) updateTag(id, { name });
    setEditingId(null);
  };

  return (
    <div className="space-y-2">
      {tags.map((tag) => (
        <div
          key={tag.id}
          className="flex items-center gap-2 py-1.5 group"
        >
          <GripVertical className="h-3.5 w-3.5 text-text-faint shrink-0" />

          {/* 顏色圓點 — 點擊換色 */}
          <Popover>
            <PopoverTrigger
              className="shrink-0 cursor-pointer"
              aria-label="換色"
            >
              <span
                className="w-4 h-4 rounded-full block"
                style={{ backgroundColor: `var(--${tag.color})` }}
              />
            </PopoverTrigger>
            <PopoverContent align="start" side="bottom" className="w-auto p-0">
              <TagColorPicker
                value={tag.color}
                onChange={(color) => updateTag(tag.id, { color })}
              />
            </PopoverContent>
          </Popover>

          {/* 名稱 — 點擊 inline 編輯 */}
          {editingId === tag.id ? (
            <input
              ref={editInputRef}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => saveEdit(tag.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit(tag.id);
                if (e.key === "Escape") setEditingId(null);
              }}
              className="flex-1 min-w-0 text-sm bg-transparent outline-none border-b border-primary text-foreground"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingId(tag.id);
                setEditingName(tag.name);
              }}
              className="flex-1 min-w-0 text-left text-sm text-foreground truncate hover:text-primary transition-colors"
            >
              {tag.name}
            </button>
          )}

          {/* 刪除 */}
          <button
            type="button"
            onClick={() => deleteTag(tag.id)}
            aria-label={`刪除 ${tag.name}`}
            className="opacity-0 group-hover:opacity-100 text-text-faint hover:text-destructive transition-all shrink-0 p-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* 新增 */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createTag();
          }}
          placeholder="新增標籤..."
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-text-faint text-foreground"
        />
        {newName.trim() && (
          <button
            type="button"
            onClick={createTag}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors shrink-0"
          >
            新增
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 SettingsModal 加入標籤管理 section**

打開 `src/components/settings/settings-modal.tsx`，在頂部 import 加入：

```ts
import { TagManager } from "@/components/tags/tag-manager";
```

在「外觀」section（紙質感開關）後面、「登出」section 前面，加入：

```tsx
          {/* 標籤管理 */}
          <section className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
              標籤管理
            </h3>
            <TagManager />
          </section>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tags/tag-manager.tsx src/components/settings/settings-modal.tsx
git commit -m "feat: Settings 標籤管理（新增、改名、換色、刪除）"
```

---

### Task 8: 卡片 list/grid 顯示 tag + 詳細頁/modal 加 TagPicker

**Files:**
- Modify: `src/components/cards/card-list-item.tsx`
- Modify: `src/components/cards/card-grid-item.tsx`
- Modify: `src/components/cards/card-detail.tsx`
- Modify: `src/components/task/task-detail-modal.tsx`

- [ ] **Step 1: card-list-item.tsx 顯示 tag badge**

打開 `src/components/cards/card-list-item.tsx`，頂部加 import：

```tsx
import { TagBadge } from "@/components/tags/tag-badge";
```

在 `<p>` (preview) 下方加 tag 列：

```tsx
          {card.tags?.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
              {card.tags.map((t) => (
                <TagBadge key={t.id} name={t.name} color={t.color} />
              ))}
            </div>
          )}
```

- [ ] **Step 2: card-grid-item.tsx 顯示 tag badge**

打開 `src/components/cards/card-grid-item.tsx`，頂部加 import：

```tsx
import { TagBadge } from "@/components/tags/tag-badge";
```

在 `<p>` (preview) 下方、footer `<div>` 前加：

```tsx
      {card.tags?.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {card.tags.map((t) => (
            <TagBadge key={t.id} name={t.name} color={t.color} />
          ))}
        </div>
      )}
```

- [ ] **Step 3: card-detail.tsx 加 TagPicker**

打開 `src/components/cards/card-detail.tsx`，頂部加 import：

```tsx
import { TagPicker } from "@/components/tags/tag-picker";
```

需要追蹤 tags state。在 component 內加 state 和 handler：

在 `const [isEditingTitle, setIsEditingTitle] = useState(false);` 附近加：

```tsx
const [cardTags, setCardTags] = useState<Array<{ id: string; name: string; color: string }>>([]);
```

加 useEffect 同步 data.tags：

```tsx
useEffect(() => {
  if (data && (data as any).tags) setCardTags((data as any).tags);
}, [data]);
```

注意：CardData interface 沒有 tags，但 API 現在回傳了。在 `CardData` interface 加：

```ts
tags?: Array<{ id: string; name: string; color: string }>;
```

然後改 useEffect：

```tsx
useEffect(() => {
  if (data?.tags) setCardTags(data.tags);
}, [data]);
```

加 handler：

```tsx
const handleTagsChange = async (tagIds: string[]) => {
  await fetch(`/api/tasks/${id}/tags`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tagIds }),
  });
  mutate();
  invalidateCardsCache();
};
```

在 header 區的日期 `<div>` 下方加 TagPicker：

```tsx
        <div className="mt-3">
          <TagPicker
            taskId={id}
            selectedTags={cardTags}
            onTagsChange={handleTagsChange}
          />
        </div>
```

在 import 加上 useState 如果還沒有的話（已有 `useState`）。

- [ ] **Step 4: task-detail-modal.tsx 加 TagPicker**

打開 `src/components/task/task-detail-modal.tsx`，頂部加 import：

```tsx
import { useState, useEffect } from "react";
import { TagPicker } from "@/components/tags/tag-picker";
```

注意：已有 `useEffect, useCallback, useRef`，加 `useState`。

在 component 內 `const saveTimerRef = useRef(...)` 附近加：

```tsx
const [taskTags, setTaskTags] = useState<Array<{ id: string; name: string; color: string }>>([]);
```

加 tag 變更 handler：

```tsx
const handleTagsChange = async (tagIds: string[]) => {
  await fetch(`/api/tasks/${task.id}/tags`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tagIds }),
  });
  // 重新取得 tags
  const res = await fetch(`/api/tasks/${task.id}/tags`);
  if (res.ok) {
    // 因為 PUT 回傳的是 tagIds，需要從 allTags 取名稱 — 簡化：直接 refetch card
  }
};
```

實際上較簡單的做法：在 `TaskDetailModalProps` 加 `tags` prop。

先在 interface 加：

```ts
interface TaskDetailModalProps {
  task: Task;
  open: boolean;
  onClose: () => void;
  onDescChange: (html: string) => void;
  onStatusChange: (status: TaskStatus) => void;
  onTagsChange?: (tagIds: string[]) => void;
  tags?: Array<{ id: string; name: string; color: string }>;
}
```

在 destructure 加 `tags = [], onTagsChange`：

```ts
export function TaskDetailModal({
  task,
  open,
  onClose,
  onDescChange,
  onStatusChange,
  onTagsChange,
  tags = [],
}: TaskDetailModalProps) {
```

在 header 的 `<StatusBadge>` 下面加：

```tsx
          {onTagsChange && (
            <div className="mt-2">
              <TagPicker
                taskId={task.id}
                selectedTags={tags}
                onTagsChange={onTagsChange}
              />
            </div>
          )}
```

注意：呼叫 TaskDetailModal 的 parent 需要傳入 tags 和 onTagsChange。這在 daily-view 中不需要（日常行動頁不顯示 tag），所以 props 是 optional。

- [ ] **Step 5: Commit**

```bash
git add src/components/cards/card-list-item.tsx src/components/cards/card-grid-item.tsx src/components/cards/card-detail.tsx src/components/task/task-detail-modal.tsx
git commit -m "feat: 卡片 list/grid 顯示 tag badge + 詳細頁/modal 加 TagPicker"
```

---

### Task 9: 看板 View 元件

**Files:**
- Create: `src/components/cards/cards-kanban.tsx`

- [ ] **Step 1: 建立 cards-kanban.tsx**

建立 `src/components/cards/cards-kanban.tsx`：

```tsx
"use client";

import { useCallback } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useTags } from "@/hooks/use-tags";
import { TagBadge } from "@/components/tags/tag-badge";
import { stripHtml } from "@/lib/strip-html";
import type { CardItem } from "@/hooks/use-cards-feed";

interface CardsKanbanProps {
  cards: CardItem[];
  onMutate: () => void;
}

export function CardsKanban({ cards, onMutate }: CardsKanbanProps) {
  const { tags } = useTags();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const cardId = active.id as string;
      const targetTagId = over.id as string;

      // 找到卡片和來源 column
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;

      // active.data.current 裡存了來源 tagId
      const sourceTagId = (active.data.current as any)?.sourceTagId;
      if (!sourceTagId || sourceTagId === targetTagId) return;

      // 替換 tag：移除來源 tag，加上目標 tag
      const currentTagIds = card.tags.map((t) => t.id);
      const newTagIds = currentTagIds
        .filter((id) => id !== sourceTagId)
        .concat(targetTagId);

      // 去重
      const uniqueTagIds = [...new Set(newTagIds)];

      await fetch(`/api/tasks/${cardId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: uniqueTagIds }),
      });
      onMutate();
    },
    [cards, onMutate]
  );

  if (tags.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-text-dim">
          建立第一個標籤來開始使用看板
        </p>
        <p className="text-xs text-text-faint mt-1">
          到設定 → 標籤管理新增標籤
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6">
        {tags.map((tag) => {
          const columnCards = cards.filter((c) =>
            c.tags.some((t) => t.id === tag.id)
          );

          return (
            <KanbanColumn
              key={tag.id}
              tag={tag}
              cards={columnCards}
            />
          );
        })}
      </div>
    </DndContext>
  );
}

interface KanbanColumnProps {
  tag: { id: string; name: string; color: string };
  cards: CardItem[];
}

function KanbanColumn({ tag, cards }: KanbanColumnProps) {
  return (
    <div
      id={tag.id}
      className="flex flex-col gap-2 min-w-[240px] w-[240px] shrink-0"
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-1 py-1.5">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: `var(--${tag.color})` }}
        />
        <span className="text-sm font-semibold text-foreground truncate">
          {tag.name}
        </span>
        <span className="text-xs text-text-dim">{cards.length}</span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-1.5">
        {cards.map((card) => (
          <KanbanCard key={`${tag.id}-${card.id}`} card={card} sourceTagId={tag.id} />
        ))}
      </div>
    </div>
  );
}

interface KanbanCardProps {
  card: CardItem;
  sourceTagId: string;
}

function KanbanCard({ card, sourceTagId }: KanbanCardProps) {
  const preview = stripHtml(card.description, 60);
  const otherTags = card.tags.filter((t) => t.id !== sourceTagId);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.setData("application/x-source-tag", sourceTagId);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <Link
        href={`/cards/${card.id}`}
        className="block p-3 rounded-lg border border-border bg-card hover:border-border-light transition-colors"
      >
        <h4 className="text-sm font-medium text-foreground line-clamp-2">
          {card.title}
        </h4>
        {preview && (
          <p className="mt-1 text-xs text-text-dim line-clamp-2">{preview}</p>
        )}
        {otherTags.length > 0 && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            {otherTags.map((t) => (
              <TagBadge key={t.id} name={t.name} color={t.color} />
            ))}
          </div>
        )}
      </Link>
    </div>
  );
}
```

注意：上面的拖移用了原生 HTML5 drag。但 spec 說用 @dnd-kit。由於看板的拖移是跨 column（不是同 column 排序），需要用 `@dnd-kit/core` 的 `Draggable` 和 `Droppable`。讓我改用 @dnd-kit 的 useDraggable / useDroppable：

替換整個檔案為：

```tsx
"use client";

import { useCallback } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { useTags } from "@/hooks/use-tags";
import { TagBadge } from "@/components/tags/tag-badge";
import { stripHtml } from "@/lib/strip-html";
import type { CardItem } from "@/hooks/use-cards-feed";

interface CardsKanbanProps {
  cards: CardItem[];
  onMutate: () => void;
}

export function CardsKanban({ cards, onMutate }: CardsKanbanProps) {
  const { tags } = useTags();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const cardId = active.id as string;
      const targetTagId = over.id as string;
      const sourceTagId = active.data.current?.sourceTagId as string;

      if (!sourceTagId || sourceTagId === targetTagId) return;

      const card = cards.find((c) => c.id === cardId);
      if (!card) return;

      const currentTagIds = card.tags.map((t) => t.id);
      const newTagIds = [...new Set(
        currentTagIds.filter((id) => id !== sourceTagId).concat(targetTagId)
      )];

      await fetch(`/api/tasks/${cardId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: newTagIds }),
      });
      onMutate();
    },
    [cards, onMutate]
  );

  if (tags.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-text-dim">建立第一個標籤來開始使用看板</p>
        <p className="text-xs text-text-faint mt-1">到設定 → 標籤管理新增標籤</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6">
        {tags.map((tag) => {
          const columnCards = cards.filter((c) =>
            c.tags.some((t) => t.id === tag.id)
          );
          return (
            <KanbanColumn key={tag.id} tag={tag} cards={columnCards} />
          );
        })}
      </div>
    </DndContext>
  );
}

function KanbanColumn({
  tag,
  cards,
}: {
  tag: { id: string; name: string; color: string };
  cards: CardItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tag.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 min-w-[240px] w-[240px] shrink-0 rounded-lg p-2 transition-colors ${
        isOver ? "bg-muted/50" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-1 py-1.5">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: `var(--${tag.color})` }}
        />
        <span className="text-sm font-semibold text-foreground truncate">
          {tag.name}
        </span>
        <span className="text-xs text-text-dim">{cards.length}</span>
      </div>
      <div className="flex flex-col gap-1.5 min-h-[60px]">
        {cards.map((card) => (
          <KanbanCard
            key={`${tag.id}-${card.id}`}
            card={card}
            sourceTagId={tag.id}
          />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({
  card,
  sourceTagId,
}: {
  card: CardItem;
  sourceTagId: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { sourceTagId },
  });

  const preview = stripHtml(card.description, 60);
  const otherTags = card.tags.filter((t) => t.id !== sourceTagId);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`${isDragging ? "opacity-40" : ""}`}
    >
      <Link
        href={`/cards/${card.id}`}
        className="block p-3 rounded-lg border border-border bg-card hover:border-border-light transition-colors"
        onClick={(e) => {
          // 拖移時不觸發導航
          if (isDragging) e.preventDefault();
        }}
      >
        <h4 className="text-sm font-medium text-foreground line-clamp-2">
          {card.title}
        </h4>
        {preview && (
          <p className="mt-1 text-xs text-text-dim line-clamp-2">{preview}</p>
        )}
        {otherTags.length > 0 && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            {otherTags.map((t) => (
              <TagBadge key={t.id} name={t.name} color={t.color} />
            ))}
          </div>
        )}
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cards/cards-kanban.tsx
git commit -m "feat: 看板 view 元件（@dnd-kit 拖移換 tag）"
```

---

### Task 10: Cards Feed 加入看板 view 切換

**Files:**
- Modify: `src/components/cards/cards-feed.tsx`

- [ ] **Step 1: 新增 kanban view 到 cards-feed.tsx**

打開 `src/components/cards/cards-feed.tsx`。

1) 頂部 import 加入：

```tsx
import { Columns3 } from "lucide-react";
import { CardsKanban } from "./cards-kanban";
```

2) 修改 `View` type：

```tsx
type View = "list" | "grid" | "kanban";
```

3) 在 view toggle 區（List 和 LayoutGrid 按鈕的 `<div>` 內），在 LayoutGrid 按鈕後面加：

```tsx
            <button
              onClick={() => handleViewChange("kanban")}
              aria-label="看板檢視"
              aria-pressed={view === "kanban"}
              className={`p-1.5 rounded transition-colors ${
                view === "kanban"
                  ? "bg-muted text-foreground"
                  : "text-text-dim hover:text-foreground"
              }`}
            >
              <Columns3 className="h-4 w-4" />
            </button>
```

4) 在卡片內容的條件渲染區（`isLoading`、`cards.length === 0` 之後），找到 `view === "list"` 的三元判斷。改為：

```tsx
      {isLoading && cards.length === 0 ? (
        <p className="text-sm text-text-dim text-center py-8">載入中...</p>
      ) : cards.length === 0 && view !== "kanban" ? (
        <p className="text-sm text-text-dim text-center py-8">
          {debouncedQuery ? "沒有符合的卡片" : "還沒有寫過內容的任務"}
        </p>
      ) : view === "kanban" ? (
        <CardsKanban cards={cards} onMutate={() => mutate()} />
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
```

注意：看板 view 需要所有卡片（不只當前頁）。目前 `useCardsFeed` 是 infinite scroll，看板會用目前載入的卡片。這在 MVP 夠用了。

- [ ] **Step 2: Commit**

```bash
git add src/components/cards/cards-feed.tsx
git commit -m "feat: cards-feed 新增看板 view 切換（list/grid/kanban）"
```

---

### Task 11: Build 驗證 + 測試步驟

- [ ] **Step 1: Build 通過**

```bash
npx next build 2>&1 | tail -10
```

預期：build 成功，無錯誤。

- [ ] **Step 2: 列出手動測試步驟給使用者**

我只驗證了 build 語法正確，實際互動流程沒有跑過，請幫我測試以下步驟：

**Tag 管理：**
1. 設定 → 標籤管理 → 新增「產品想法」「技術筆記」「會議記錄」三個 tag
2. 點顏色圓點換色，確認顏色更新
3. 點名稱 inline 編輯，確認改名成功
4. 刪除一個 tag，確認消失

**Tag 指派：**
5. 打開一張卡片詳細頁 → 點 tag picker → 選取 tag → 卡片顯示 tag badge
6. 再選第二個 tag → 卡片有兩個 badge
7. 移除一個 tag → badge 消失
8. 在 tag picker 搜尋不存在的名稱 → 出現「建立 xxx」→ 點擊建立 → 自動選取

**看板 view：**
9. 切到看板 view → 看到三個 column（依 tag 分）
10. 有 tag 的卡片出現在對應 column
11. 多 tag 的卡片出現在多個 column
12. 拖移卡片到另一個 column → tag 替換成功 → 卡片移過去
13. 切回 list view → tag badge 顯示正確
14. 沒有任何 tag 時看板顯示空狀態提示

- [ ] **Step 3: 最終 commit（如有微調）**

```bash
git add -A
git commit -m "fix: 卡片看板 + tag 系統微調"
```

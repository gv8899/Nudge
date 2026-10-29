"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, GripVertical, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  parseChecklist,
  checklistTransition,
  type ChecklistItem,
  type ChecklistEdit,
} from "@/lib/checklist";
import { isChecklistCollapsed, setChecklistCollapsed } from "@/lib/checklist-collapse";
import type { DailyTaskAssignment } from "@/lib/types";

// 任務列上的 checklist 子項目 UI —— 進度膠囊 + 可勾選的子項目列 + 新增列。
// 資料與存檔都在 TaskCard / daily-view 處理，這裡只負責呈現與把操作往上拋。
// 子項目縮排對齊母任務標題：row 的 px-3(12) + grip(16) + gap-2(8) + checkbox(18)
// + gap-2(8) = 62px。

const INDENT = "pl-[62px]"; // 對齊母任務標題左緣
const TEXT_INDENT = "ml-[26px]"; // 子項目核取框(18) + gap-2(8)

// 一筆任務列的 checklist 狀態 + 操作，TaskCard 與 OverdueRow 共用。
// 重複任務一律空（第一階段不顯示）。收合狀態：未完成任務讀/寫 localStorage，
// 已完成任務一律從收合開始、點膠囊只改本地 state（不寫入記憶）。
export function useTaskChecklist(
  assignment: DailyTaskAssignment,
  onChecklistEdit: (assignment: DailyTaskAssignment, edit: ChecklistEdit) => void,
) {
  const { task } = assignment;
  const isRecurring = assignment.isRecurring;
  const items = useMemo(
    () => (isRecurring ? [] : parseChecklist(task.description)),
    [isRecurring, task.description],
  );
  const total = items.length;
  const done = items.filter((i) => i.checked).length;
  const hasChecklist = total > 0;

  const [collapsed, setCollapsed] = useState(() =>
    assignment.isCompleted ? true : isChecklistCollapsed(task.id),
  );
  const [adding, setAdding] = useState(false);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (!assignment.isCompleted) setChecklistCollapsed(task.id, next);
  };

  const startAdding = () => {
    setCollapsed(false);
    if (!assignment.isCompleted) setChecklistCollapsed(task.id, false);
    setAdding(true);
  };

  const toggleItem = (index: number) => {
    const item = items[index];
    if (!item) return;
    onChecklistEdit(assignment, {
      kind: "toggle",
      index,
      text: item.text,
      checked: !item.checked,
    });
  };

  const append = (text: string) => onChecklistEdit(assignment, { kind: "append", text });

  const remove = (index: number) => {
    const item = items[index];
    if (!item) return;
    onChecklistEdit(assignment, { kind: "remove", index, text: item.text });
  };

  const setItemText = (index: number, newText: string) => {
    const item = items[index];
    if (!item) return;
    const next = newText.trim();
    if (!next || next === item.text) return; // 空或沒變則不送
    onChecklistEdit(assignment, { kind: "setText", index, text: item.text, newText: next });
  };

  const move = (from: number, to: number) => {
    const item = items[from];
    if (!item || from === to) return;
    onChecklistEdit(assignment, { kind: "move", from, to, text: item.text });
  };

  // 勾母任務（未完成→完成）且有未勾子項目 → 子項目全勾。取消完成不動子項目。
  const syncChildrenOnParentComplete = (completing: boolean) => {
    if (completing && hasChecklist && done < total) {
      onChecklistEdit(assignment, { kind: "checkAll" });
    }
  };

  const showBody = (hasChecklist && !collapsed) || adding;

  return {
    isRecurring,
    items,
    done,
    total,
    hasChecklist,
    collapsed,
    adding,
    showBody,
    setAdding,
    toggleCollapsed,
    startAdding,
    toggleItem,
    append,
    remove,
    setItemText,
    move,
    syncChildrenOnParentComplete,
  };
}

// 詳情視窗內文改動 → 母任務完成狀態該怎麼變（true=完成 / false=取消 / null=不動）。
// 只看轉變、略過重複任務；由呼叫端配一個 lastDescRef 當 before。
export function checklistCompletionFromDescChange(
  before: string | null | undefined,
  html: string,
  isRecurring: boolean,
  isCompleted: boolean,
): boolean | null {
  if (isRecurring) return null;
  const tr = checklistTransition(before, html);
  if (tr === "became-all-checked" && !isCompleted) return true;
  if (tr === "left-all-checked" && isCompleted) return false;
  return null;
}

export function TaskChecklistPill({
  done,
  total,
  collapsed,
  onToggleCollapsed,
}: {
  done: number;
  total: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const t = useTranslations("task");
  const allDone = total > 0 && done === total;
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggleCollapsed();
      }}
      aria-label={collapsed ? t("checklist.expand") : t("checklist.collapse")}
      aria-expanded={!collapsed}
      className={`flex items-center justify-center rounded p-1 shrink-0 cursor-pointer transition-colors hover:text-primary ${
        allDone ? "text-primary" : "text-text-dim"
      }`}
    >
      <Chevron className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

// 用右外距（不是 padding）把這一列往左收，讓刪除 ✕ 落在標題列「進度膠囊」那一欄，
// 同時 hover 底圖只包到 ✕ 為止、不延伸到卡片右緣。
// 欄寬 ＋(32)+gap(8)+日曆(32)+gap(8)+⋯(24)=112，再扣掉區塊自己的右內距 6 → 106。
const RIGHT_CLUSTER = "mr-[106px]";

export function TaskChecklistBody({
  items,
  adding,
  onToggleItem,
  onAppend,
  onRemove,
  onSetText,
  onMove,
  onAddingChange,
}: {
  items: ChecklistItem[];
  adding: boolean;
  onToggleItem: (index: number) => void;
  onAppend: (text: string) => void;
  onRemove: (index: number) => void;
  onSetText: (index: number, newText: string) => void;
  onMove: (from: number, to: number) => void;
  onAddingChange: (adding: boolean) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // 子項目各自一個小拖放區（跟母任務的拖放互不干擾）；只靠左側把手啟動，距離 4px
  // 才算拖曳，避免點勾選/文字被誤判成拖。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = Number(String(active.id).slice(4)); // 去掉 "sub-"
    const to = Number(String(over.id).slice(4));
    if (Number.isNaN(from) || Number.isNaN(to)) return;
    onMove(from, to);
  };
  const ids = items.map((_, i) => `sub-${i}`);
  return (
    <div className={`${INDENT} flex flex-col gap-0.5 pr-3 pb-2`}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {items.map((item, index) => (
            <SortableSubItem
              // 子項目不支援獨立 id，以內文順序 index 當識別，index 即身分。
              key={index}
              id={`sub-${index}`}
              item={item}
              index={index}
              editing={editingIndex === index}
              onToggle={onToggleItem}
              onRemove={onRemove}
              onSetText={onSetText}
              onStartEdit={setEditingIndex}
              onEndEdit={() => setEditingIndex(null)}
            />
          ))}
        </SortableContext>
      </DndContext>
      {adding && (
        <AddRow
          textIndent={items.length > 0 ? "" : TEXT_INDENT}
          onAppend={onAppend}
          onAddingChange={onAddingChange}
        />
      )}
    </div>
  );
}

// 一列子項目：左側拖移把手（滑到才亮）+ 勾選框 + 文字（點可改）+ 刪除 ✕。
function SortableSubItem({
  id,
  item,
  index,
  editing,
  onToggle,
  onRemove,
  onSetText,
  onStartEdit,
  onEndEdit,
}: {
  id: string;
  item: ChecklistItem;
  index: number;
  editing: boolean;
  onToggle: (index: number) => void;
  onRemove: (index: number) => void;
  onSetText: (index: number, newText: string) => void;
  onStartEdit: (index: number) => void;
  onEndEdit: () => void;
}) {
  const t = useTranslations("task");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      // 滑到哪一項，那列給半透明較深的底，讓人知道自己在哪個子項目上。
      // 左 2.5(10px) 讓勾選框留白跟右邊 ✕ 一致；右側只包到 ✕（見 RIGHT_CLUSTER）。
      className={`group/item relative flex items-center gap-2 rounded-md py-1.5 pl-2.5 pr-1.5 transition-colors hover:bg-background/40 ${RIGHT_CLUSTER}`}
    >
      {/* 拖移把手 —— 在左側 gutter，滑到這列才亮；拖它排序（參考 Notion） */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t("dragReorder", { title: item.text })}
        className="absolute -left-5 top-1/2 -translate-y-1/2 opacity-0 transition-opacity cursor-grab active:cursor-grabbing text-text-faint hover:text-primary group-hover/item:opacity-100 touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={t("checklist.itemAria", {
          text: item.text,
          state: item.checked ? t("stateCompleted") : t("stateIncomplete"),
        })}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(index);
        }}
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-2 transition-colors cursor-pointer ${
          item.checked
            ? "border-primary bg-primary"
            : "border-text-dim bg-transparent group-hover/item:border-muted-foreground"
        }`}
      >
        {item.checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {editing ? (
        <ChecklistItemInput
          initial={item.text}
          onCommit={(v) => {
            onSetText(index, v);
            onEndEdit();
          }}
          onCancel={onEndEdit}
        />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit(index);
          }}
          className={`min-w-0 flex-1 truncate text-left text-primary-row-title cursor-text ${
            item.checked ? "text-text-dim line-through" : "text-foreground"
          }`}
        >
          {item.text}
        </button>
      )}

      <button
        type="button"
        aria-label={t("checklist.removeAria", { text: item.text })}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        className="shrink-0 rounded p-1 text-text-faint opacity-0 transition-colors cursor-pointer hover:text-primary group-hover/item:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

// 行內編輯框 —— 點文字時換上，Enter / 失焦存檔，Esc 取消。子項目與母任務標題共用。
// commit / cancel 只跑一次（Enter 後卸載會再觸發 blur，用 done 擋掉）。
export function ChecklistItemInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    onCommit(value);
  };
  const cancel = () => {
    if (done.current) return;
    done.current = true;
    onCancel();
  };

  return (
    <input
      ref={inputRef}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        // 中文等輸入法組字中的 Enter 是確認選字，放掉。
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === "Enter") commit();
        else if (e.key === "Escape") cancel();
      }}
      onBlur={commit}
      className="min-w-0 flex-1 border-b border-border bg-transparent py-0.5 text-primary-row-title text-foreground outline-none"
    />
  );
}

// 新增列只在「新增中」才掛載 —— 入口是標題列的 ＋ 圖示（呼叫 startAdding）。
// 按 Enter 連續新增（輸入框留著、清空），Esc / 失焦結束。
function AddRow({
  textIndent,
  onAppend,
  onAddingChange,
}: {
  textIndent: string;
  onAppend: (text: string) => void;
  onAddingChange: (adding: boolean) => void;
}) {
  const t = useTranslations("task");
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <input
      ref={inputRef}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        // 中文等輸入法「組字中」的 Enter 是確認選字，不是送出。
        // 放掉它，等使用者再按一次（非組字）才新增，避免多複製一個字。
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === "Enter") {
          const v = value.trim();
          if (v) {
            onAppend(v);
            setValue("");
          }
        } else if (e.key === "Escape") {
          setValue("");
          onAddingChange(false);
        }
      }}
      onBlur={() => {
        setValue("");
        onAddingChange(false);
      }}
      placeholder={t("checklist.placeholder")}
      className={`w-full border-b border-border bg-transparent py-0.5 text-primary-row-title text-foreground outline-none placeholder:text-text-faint ${textIndent}`}
    />
  );
}

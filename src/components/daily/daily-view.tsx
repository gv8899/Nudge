"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { mutate as globalMutate } from "swr";
import { useDaily } from "@/hooks/use-daily";
import { TaskCard } from "@/components/task/task-card";
import { QuickAddDialog } from "@/components/task/quick-add-dialog";
import { TaskFab } from "@/components/task/task-fab";
import { CalendarNav, WeekNavControls } from "@/components/calendar/calendar-nav";
import { DateHeading } from "@/components/calendar/date-heading";
import { OverdueSection } from "@/components/daily/overdue-section";
import { DailyRightPanel, type RightPanelKind } from "@/components/daily/daily-right-panel";
import { IconCards, IconCalendar, IconSidebarRight } from "@/components/ui/sf-icon";
import { useSidebarCollapsed } from "@/components/sidebar/sidebar-layout";
import { OfflineBanner, ErrorBanner } from "@/components/daily/daily-banners";
import { useOnline } from "@/hooks/use-online";
import { isoToday } from "@/lib/calendar-dates";
import type { TaskStatus } from "@/lib/constants";
import { ChevronRight, Sparkles } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

// ── localStorage keys ──────────────────────────────────────────────────────
const LS_PANEL_OPEN = "daily.web.rightPanelOpen";
const LS_PANEL_KIND = "daily.web.rightPanelKind";
const LS_PANEL_WIDTH = "daily.web.rightPanelWidth";

const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 280;
const MAX_WIDTH = 720;

function clampWidth(w: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));
}

// SSR-safe localStorage read helpers
function lsReadBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  if (v === null) return fallback;
  return v === "true";
}

function lsReadString<T extends string>(key: string, fallback: T, allowed: T[]): T {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key) as T | null;
  if (v !== null && allowed.includes(v)) return v;
  return fallback;
}

function lsReadNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  if (v === null) return fallback;
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}


interface DailyViewProps {
  date: string;
}

// 任務狀態 / 內容變更時，invalidate 所有 cards 相關 SWR cache，
// 讓 /cards 頁面下次顯示時是最新狀態。
function invalidateCardsCache() {
  globalMutate(
    (key) => typeof key === "string" && key.startsWith("/api/cards"),
    undefined,
    { revalidate: true }
  );
}

export function DailyView({ date: initialDate }: DailyViewProps) {
  const t = useTranslations("daily");
  const sidebarCollapsed = useSidebarCollapsed();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [completedExpanded, setCompletedExpanded] = useState(true);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const { data, isLoading, error, mutate } = useDaily(currentDate);
  const online = useOnline();
  // 最後一次成功載入的時間（offline banner 顯示用）
  const lastUpdatedRef = useRef<string>("");
  useEffect(() => {
    if (data) {
      const d = new Date();
      lastUpdatedRef.current = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
  }, [data]);

  // ── Right-panel state (lazy-init from localStorage, SSR-safe) ──────────
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(false);
  const [rightPanelKind, setRightPanelKind] = useState<RightPanelKind>("calendar");
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(DEFAULT_WIDTH);
  const [detailId, setDetailId] = useState<string | null>(null);
  // Remember which kind was active before "detail" so we can return to it
  const prevKindRef = useRef<RightPanelKind>("cards");
  // Track lg+ breakpoint so we only apply right-padding on large screens
  const [isLg, setIsLg] = useState<boolean>(false);

  // Hydrate from localStorage once on mount (avoids SSR mismatch)
  useEffect(() => {
    setRightPanelOpen(lsReadBool(LS_PANEL_OPEN, false));
    const storedKind = lsReadString<RightPanelKind>(LS_PANEL_KIND, "calendar", ["calendar", "cards"]);
    setRightPanelKind(storedKind);
    setRightPanelWidth(clampWidth(lsReadNumber(LS_PANEL_WIDTH, DEFAULT_WIDTH)));
  }, []);

  // Track lg+ so we can gate the paddingRight calculation
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsLg(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLg(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Persist changes（寫 localStorage 不放在 setState updater 內 —
  // updater 必須是純函式，StrictMode 下會被呼叫兩次）
  const handleTogglePanel = () => {
    const next = !rightPanelOpen;
    setRightPanelOpen(next);
    localStorage.setItem(LS_PANEL_OPEN, String(next));
  };

  const handleKindChange = (kind: RightPanelKind) => {
    setRightPanelKind(kind);
    setDetailId(null);
    localStorage.setItem(LS_PANEL_KIND, kind);
  };

  const openDetailInPanel = (id: string) => {
    // Remember current kind (if not already in detail) so we can return to it
    if (rightPanelKind !== "detail") {
      prevKindRef.current = rightPanelKind;
    }
    setDetailId(id);
    setRightPanelKind("detail");
    setRightPanelOpen(true);
    localStorage.setItem(LS_PANEL_OPEN, "true");
    // Do NOT persist "detail" to localStorage
  };

  const closeDetail = () => {
    setRightPanelKind(prevKindRef.current);
    setDetailId(null);
  };

  const handleWidthChange = (px: number) => {
    const clamped = clampWidth(px);
    setRightPanelWidth(clamped);
    localStorage.setItem(LS_PANEL_WIDTH, String(clamped));
  };

  // ── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleCreateTask = async (title: string) => {
    await fetch(`/api/daily/${currentDate}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, status: "in_progress" }),
    });
    mutate();
  };

  const handleToggleComplete = async (
    assignmentId: string,
    taskId: string,
    completed: boolean
  ) => {
    // 樂觀更新
    if (data) {
      const optimistic = {
        ...data,
        assignments: data.assignments.map((a) =>
          a.id === assignmentId ? { ...a, isCompleted: completed } : a
        ),
      };
      mutate(optimistic, false);
    }

    await fetch(`/api/daily/${currentDate}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, taskId, isCompleted: completed }),
    });
    mutate();
    invalidateCardsCache();
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    // 樂觀更新
    if (data) {
      const optimistic = {
        ...data,
        assignments: data.assignments.map((a) =>
          a.task.id === taskId ? { ...a, task: { ...a.task, status } } : a
        ),
      };
      mutate(optimistic, false);
    }

    await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    mutate();
    invalidateCardsCache();
  };

  const handleMoveToDate = async (
    assignmentId: string,
    targetDate: string
  ) => {
    // 樂觀移除
    if (data) {
      const optimistic = {
        ...data,
        assignments: data.assignments.filter((a) => a.id !== assignmentId),
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

  const handleArchive = async (assignmentId: string, taskId: string) => {
    // 樂觀移除
    if (data) {
      const optimistic = {
        ...data,
        overdueTasks: (data.overdueTasks || []).filter((a) => a.id !== assignmentId),
        assignments: (data.assignments || []).filter((a) => a.id !== assignmentId),
      };
      mutate(optimistic, false);
    }

    await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    mutate();
    invalidateCardsCache();
  };

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
    invalidateCardsCache();
  };

  const handleUpdateTask = async (
    taskId: string,
    updates: { title?: string; description?: string }
  ) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    mutate();
    invalidateCardsCache();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Only incomplete tasks are in the SortableContext; look up indices within that slice.
    const incompleteOnly = (data?.assignments || []).filter((a) => !a.isCompleted);
    const oldIndex = incompleteOnly.findIndex((a) => a.id === active.id);
    const newIndex = incompleteOnly.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedIncomplete = arrayMove(incompleteOnly, oldIndex, newIndex);
    const completedOnly = (data?.assignments || []).filter((a) => a.isCompleted);
    mutate({ ...data!, assignments: [...reorderedIncomplete, ...completedOnly] }, false);

    await fetch(`/api/daily/${currentDate}/tasks/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: reorderedIncomplete.map((a, i) => ({ id: a.id, sortOrder: i })),
      }),
    });
    mutate();
  };

  // 401 時導向登入頁（只做一次）
  if (error && (error as any).status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  const showErrorBanner = !!error && (error as { status?: number }).status !== 401;

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-text-dim">
        {tCommon("loading")}
      </div>
    );
  }

  const allAssignments = data?.assignments || [];
  const incompleteAssignments = allAssignments.filter((a) => !a.isCompleted);
  const completedAssignments = allAssignments.filter((a) => a.isCompleted);

  // Right-panel padding: only apply when panel is open AND we're on lg+
  // （+8 = 卡片式面板 right-2 的內縮）
  const mainPaddingRight = rightPanelOpen && isLg ? rightPanelWidth + 8 : 0;

  return (
    <>
      {/* Right panel — 常駐掛載、開關用滑動動畫（對齊 Mac 所有 view 常駐）；lg+ only */}
      <DailyRightPanel
        open={rightPanelOpen}
        kind={rightPanelKind}
        width={rightPanelWidth}
        onWidthChange={handleWidthChange}
        date={currentDate}
        detailId={detailId}
        onBackFromDetail={closeDetail}
        onOpenCard={openDetailInPanel}
      />

      <div
        className="min-h-screen bg-background lg:transition-[padding-right] lg:duration-300 lg:ease-out"
        style={{ paddingRight: mainPaddingRight }}
      >
        <div className="mx-auto max-w-[760px] px-4 md:px-6 pb-8">
          {!online && <OfflineBanner lastUpdated={lastUpdatedRef.current} />}
          {online && showErrorBanner && <ErrorBanner onRetry={() => mutate()} />}

          {/* 週導覽 — 手機在內容流內；md+ 進頂部 toolbar 帶（對齊 Mac
              titlebar 的 ‹ Today › 緊接 sidebar toggle 之後） */}
          <div className="pt-6 mb-2 flex items-center md:hidden">
            <WeekNavControls date={currentDate} onDateChange={setCurrentDate} />
          </div>
          {/* 對齊 Mac titlebar：展開時在 sidebar 右側，收合時緊接 toggle（10+36+8），
              跟著 sidebar 開合一起滑動 */}
          <div
            className="hidden md:flex items-center fixed top-[14px] h-9 z-40 transition-[left] duration-300 ease-out"
            style={{ left: sidebarCollapsed ? 66 : 200 }}
          >
            <WeekNavControls date={currentDate} onDateChange={setCurrentDate} />
          </div>

          {/* Right-panel controls — 對齊 Mac：頂部 toolbar 帶右段（lg+ only） */}
          <div className="hidden lg:flex items-center gap-2 fixed top-[14px] h-9 right-6 z-40">
              {/* Panel toggle — SF sidebar.right、寬扁膠囊（48×36）+ 16px 字形、
                  開啟時 tan 填滿（對齊 Mac）。 */}
              <button
                type="button"
                onClick={handleTogglePanel}
                aria-label={t("toggleRightPanel")}
                title={t("toggleRightPanel")}
                aria-pressed={rightPanelOpen}
                className={
                  rightPanelOpen
                    ? "flex items-center justify-center h-9 w-12 rounded-full bg-primary text-primary-foreground transition-colors"
                    : "flex items-center justify-center h-9 w-12 rounded-full bg-card/80 backdrop-blur-md shadow-sm text-text-dim hover:text-foreground hover:bg-card transition-colors"
                }
              >
                <IconSidebarRight className="h-4 w-4" />
              </button>

              {/* Kind picker segmented — 只在面板開啟時顯示；膠囊容器 + 淡 highlight（非 tan 重填） */}
              {rightPanelOpen && (
                <div className="flex items-center gap-0.5 p-1 rounded-full bg-muted">
                  <button
                    type="button"
                    onClick={() => handleKindChange("calendar")}
                    aria-label={tNav("calendar")}
                    title={tNav("calendar")}
                    aria-pressed={rightPanelKind === "calendar"}
                    className={
                      rightPanelKind === "calendar"
                        ? "flex items-center justify-center h-7 w-10 rounded-full bg-background text-foreground shadow-sm transition-colors"
                        : "flex items-center justify-center h-7 w-10 rounded-full text-text-dim hover:text-foreground transition-colors"
                    }
                  >
                    <IconCalendar className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKindChange("cards")}
                    aria-label={tNav("cards")}
                    title={tNav("cards")}
                    aria-pressed={rightPanelKind === "cards" || rightPanelKind === "detail"}
                    className={
                      rightPanelKind === "cards" || rightPanelKind === "detail"
                        ? "flex items-center justify-center h-7 w-10 rounded-full bg-background text-foreground shadow-sm transition-colors"
                        : "flex items-center justify-center h-7 w-10 rounded-full text-text-dim hover:text-foreground transition-colors"
                    }
                  >
                    <IconCards className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

          <div className="pb-1 md:pt-5">
            <DateHeading date={currentDate} />
          </div>

          {/* sticky 錨點 md+ 要落在 top bar (48px) 下緣，否則會滑進 bar 底下 */}
          <div className="sticky top-0 md:top-12 z-10 py-2 bg-background">
            <CalendarNav date={currentDate} onDateChange={setCurrentDate} />
          </div>

          <div className="space-y-0 pt-2">
            <OverdueSection
              overdueTasks={data?.overdueTasks || []}
              currentDate={currentDate}
              onToggleComplete={handleOverdueToggleComplete}
              onReschedule={handleReschedule}
              onArchive={handleArchive}
            />
            {currentDate === isoToday() && allAssignments.length > 0 && (
              <div className="px-6 py-1.5 text-section-header text-text-dim">
                {t("todayHeader", { count: allAssignments.length })}
              </div>
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={incompleteAssignments.map((a) => a.id)}
                strategy={verticalListSortingStrategy}
              >
                {incompleteAssignments.map((a) => (
                  <TaskCard
                    key={a.id}
                    assignment={a}
                    currentDate={currentDate}
                    onToggleComplete={handleToggleComplete}
                    onStatusChange={handleStatusChange}
                    onMoveToDate={handleMoveToDate}
                    onUpdateTask={handleUpdateTask}
                    onOpenDetail={openDetailInPanel}
                    onArchive={handleArchive}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {completedAssignments.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setCompletedExpanded((v) => !v)}
                  aria-expanded={completedExpanded}
                  className="flex items-center justify-between gap-1 pl-6 pr-4 py-1.5 text-section-header text-text-dim hover:text-muted-foreground transition-colors w-full text-left"
                >
                  <span>{t("completedHeader", { count: completedAssignments.length })}</span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${completedExpanded ? "rotate-90" : ""}`}
                  />
                </button>
                {completedExpanded &&
                  completedAssignments.map((a) => (
                    <TaskCard
                      key={a.id}
                      assignment={a}
                      currentDate={currentDate}
                      onToggleComplete={handleToggleComplete}
                      onStatusChange={handleStatusChange}
                      onMoveToDate={handleMoveToDate}
                      onUpdateTask={handleUpdateTask}
                      onOpenDetail={openDetailInPanel}
                      onArchive={handleArchive}
                    />
                  ))}
              </div>
            )}

            {allAssignments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Sparkles className="h-6 w-6 text-text-dim" />
                <p className="text-empty-state text-text-dim text-center">
                  {t("emptyToday")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* FAB 浮在任務欄右下（Mac trailing 24 / bottom 80）— 外層複製
          內容欄的幾何（sidebar margin + panel padding + 置中 760），
          FAB 才會貼著欄位右緣而不是視窗右緣。 */}
      <div
        className={`fixed bottom-20 left-0 right-0 z-30 pointer-events-none ${
          sidebarCollapsed ? "" : "md:pl-[196px]"
        } transition-[padding] duration-300 ease-out`}
        style={{ paddingRight: mainPaddingRight }}
      >
        <div className="mx-auto max-w-[760px] flex justify-end pr-6">
          <TaskFab onClick={() => setQuickAddOpen(true)} />
        </div>
      </div>
      <QuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onSubmit={handleCreateTask}
      />
    </>
  );
}

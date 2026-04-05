"use client";

import { useDaily } from "@/hooks/use-daily";
import { TaskCard } from "@/components/task/task-card";
import { TaskCreate } from "@/components/task/task-create";
import { DailyNotes } from "@/components/daily/daily-notes";
import { CalendarNav } from "@/components/calendar/calendar-nav";
import { DateHeading } from "@/components/calendar/date-heading";
import type { TaskStatus } from "@/lib/constants";
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

interface DailyViewProps {
  date: string;
}

export function DailyView({ date }: DailyViewProps) {
  const { data, isLoading, mutate } = useDaily(date);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleCreateTask = async (title: string) => {
    await fetch(`/api/daily/${date}/tasks`, {
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
    await fetch(`/api/daily/${date}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, taskId, isCompleted: completed }),
    });
    mutate();
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    mutate();
  };

  const handleMoveToDate = async (
    assignmentId: string,
    targetDate: string
  ) => {
    await fetch(`/api/daily/${date}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, moveToDate: targetDate }),
    });
    mutate();
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
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = assignments.findIndex((a) => a.id === active.id);
    const newIndex = assignments.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // 樂觀更新
    const reordered = arrayMove(assignments, oldIndex, newIndex);
    mutate({ ...data!, assignments: reordered }, false);

    // 更新每個 assignment 的 sortOrder
    await Promise.all(
      reordered.map((a, i) =>
        fetch(`/api/daily/${date}/tasks`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId: a.id, sortOrder: i }),
        })
      )
    );
    mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center text-[#6b6d71]">
        載入中...
      </div>
    );
  }

  const assignments = data?.assignments || [];
  const noteContent = data?.noteContent || "";

  return (
    <div className="min-h-screen bg-[#1e1f22]">
      <div
        className="mx-auto max-w-5xl px-6 pb-8 grid gap-x-6"
        style={{
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "auto auto 1fr",
        }}
      >
        {/* Row 1, Col 1: 日期標題 */}
        <div className="pt-4 pb-1" style={{ gridColumn: 1, gridRow: 1 }}>
          <DateHeading date={date} />
        </div>

        {/* Row 2, Col 1: 週曆 bar */}
        <div
          className="sticky top-0 z-10 py-2 bg-[#1e1f22]"
          style={{ gridColumn: 1, gridRow: 2 }}
        >
          <CalendarNav date={date} />
        </div>

        {/* Row 2+3, Col 2: 筆記 */}
        <div style={{ gridColumn: 2, gridRow: "2 / 4", alignSelf: "start" }}>
          <DailyNotes date={date} initialContent={noteContent} />
        </div>

        {/* Row 3, Col 1: 任務列表（可拖曳排序） */}
        <div className="space-y-0 pt-2" style={{ gridColumn: 1, gridRow: 3 }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={assignments.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              {assignments.map((a) => (
                <TaskCard
                  key={a.id}
                  assignment={a}
                  currentDate={date}
                  onToggleComplete={handleToggleComplete}
                  onStatusChange={handleStatusChange}
                  onMoveToDate={handleMoveToDate}
                  onUpdateTask={handleUpdateTask}
                />
              ))}
            </SortableContext>
          </DndContext>

          {assignments.length === 0 && (
            <p className="text-sm text-[#6b6d71] py-4 text-center">
              今天還沒有任務
            </p>
          )}

          <TaskCreate onSubmit={handleCreateTask} />
        </div>
      </div>
    </div>
  );
}

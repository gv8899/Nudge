"use client";

import { useState } from "react";
import { useDaily } from "@/hooks/use-daily";
import { TaskCard } from "@/components/task/task-card";
import { TaskCreate } from "@/components/task/task-create";
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

export function DailyView({ date: initialDate }: DailyViewProps) {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const { data, isLoading, error, mutate } = useDaily(currentDate);

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

    const reordered = arrayMove(assignments, oldIndex, newIndex);
    mutate({ ...data!, assignments: reordered }, false);

    await fetch(`/api/daily/${currentDate}/tasks/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: reordered.map((a, i) => ({ id: a.id, sortOrder: i })),
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

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-text-dim">
        載入中...
      </div>
    );
  }

  const assignments = [...(data?.assignments || [])].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 md:px-6 pb-8">
        <div className="pt-4 pb-1">
          <DateHeading date={currentDate} />
        </div>

        <div className="sticky top-0 z-10 py-2 bg-background">
          <CalendarNav date={currentDate} onDateChange={setCurrentDate} />
        </div>

        <div className="space-y-0 pt-2">
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
                  currentDate={currentDate}
                  onToggleComplete={handleToggleComplete}
                  onStatusChange={handleStatusChange}
                  onMoveToDate={handleMoveToDate}
                  onUpdateTask={handleUpdateTask}
                />
              ))}
            </SortableContext>
          </DndContext>

          {assignments.length === 0 && (
            <p className="text-sm text-text-dim py-4 text-center">
              今天還沒有任務
            </p>
          )}

          <TaskCreate onSubmit={handleCreateTask} />
        </div>
      </div>
    </div>
  );
}

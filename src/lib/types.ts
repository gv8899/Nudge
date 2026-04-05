import type { TaskStatus } from "./constants";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  remindAt: string | null;
  sortOrder: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface StatusHistoryEntry {
  id: string;
  taskId: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  note: string | null;
}

export interface DailyTaskAssignment {
  id: string;
  taskId: string;
  date: string;
  isCompleted: boolean;
  sortOrder: number;
  task: Task;
}

export interface DailyNote {
  id: string;
  date: string;
  content: string;
  createdAt: string;
  sortOrder: number;
}

export interface DailyData {
  date: string;
  assignments: DailyTaskAssignment[];
  noteContent: string;
}

export const TASK_STATUSES = {
  inbox: { label: "暫記", color: "var(--status-inbox)", bgColor: "color-mix(in srgb, var(--status-inbox) 12%, transparent)" },
  backlog: { label: "待排入", color: "var(--status-backlog)", bgColor: "color-mix(in srgb, var(--status-backlog) 12%, transparent)" },
  in_progress: { label: "自己處理中", color: "var(--status-in-progress)", bgColor: "color-mix(in srgb, var(--status-in-progress) 12%, transparent)" },
  waiting: { label: "等待他人", color: "var(--status-waiting)", bgColor: "color-mix(in srgb, var(--status-waiting) 12%, transparent)" },
  done: { label: "完成", color: "var(--status-done)", bgColor: "color-mix(in srgb, var(--status-done) 12%, transparent)" },
  archived: { label: "已封存", color: "var(--status-archived)", bgColor: "color-mix(in srgb, var(--status-archived) 12%, transparent)" },
} as const;

export type TaskStatus = keyof typeof TASK_STATUSES;

export const TASK_STATUS_LIST: TaskStatus[] = [
  "inbox",
  "backlog",
  "in_progress",
  "waiting",
  "done",
  "archived",
];

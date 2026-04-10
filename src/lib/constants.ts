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

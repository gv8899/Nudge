export const TASK_STATUSES = {
  inbox: { label: "暫記", color: "#9b9da0", bgColor: "#3a3c40" },
  backlog: { label: "待排入", color: "#5cb3e8", bgColor: "#1e3a4f" },
  in_progress: { label: "自己處理中", color: "#e8a855", bgColor: "#3d3222" },
  waiting: { label: "等待他人", color: "#b58af0", bgColor: "#332b47" },
  done: { label: "完成", color: "#5ec269", bgColor: "#253229" },
} as const;

export type TaskStatus = keyof typeof TASK_STATUSES;

export const TASK_STATUS_LIST: TaskStatus[] = [
  "inbox",
  "backlog",
  "in_progress",
  "waiting",
  "done",
];

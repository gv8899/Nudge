import { CheckSquare, FileText, CalendarDays, GripVertical } from "lucide-react";

/** 純 CSS 的 Tasks 頁 mockup，不使用真實資料，只展示視覺 */
export function MockupTasks() {
  return (
    <div
      className="pointer-events-none select-none rounded-2xl border border-border bg-background overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]"
      aria-hidden="true"
    >
      <div className="p-8">
        {/* 標題區 */}
        <div className="mb-4">
          <div className="text-xl font-bold text-foreground">行動</div>
        </div>

        {/* 日期 heading */}
        <div className="mb-4">
          <div className="text-xs text-primary font-medium mb-1">
            Thursday
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            4/10, 2026
          </div>
        </div>

        {/* 前幾天的區塊 */}
        <div className="flex items-center gap-2 text-sm text-primary mb-1">
          <CheckSquare className="h-4 w-4" />
          <span className="font-medium">前幾天的 (2)</span>
        </div>
        <TaskRow title="繳水電費" dateLabel="4/5" dotColor="#c89968" />
        <TaskRow title="回覆客戶 Email" dateLabel="4/7" dotColor="#c89968" />

        <div className="h-2" />

        {/* 今天任務 */}
        <TaskRow title="早晨運動" checked dotColor="#8aa57d" />
        <TaskRow title="寫週報" dotColor="#c89968" />
        <TaskRow title="準備簡報" dotColor="#a78aaf" />
        <TaskRow title="閱讀 1 章" dotColor="#7a8b9c" />
      </div>
    </div>
  );
}

function TaskRow({
  title,
  checked = false,
  dateLabel,
  dotColor,
}: {
  title: string;
  checked?: boolean;
  dateLabel?: string;
  dotColor: string;
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-2 rounded-md">
      <GripVertical className="h-4 w-4 text-text-faint opacity-0" />
      <div
        className={`h-[18px] w-[18px] rounded-[4px] border-2 flex items-center justify-center ${
          checked ? "bg-primary border-primary" : "border-text-dim"
        }`}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span
        className={`flex-1 text-sm ${
          checked ? "line-through text-text-dim" : "text-foreground"
        }`}
      >
        {title}
      </span>
      {dateLabel && (
        <span className="text-xs text-text-dim tabular-nums mr-1">
          {dateLabel}
        </span>
      )}
      <FileText className="h-4 w-4 text-text-faint" />
      <CalendarDays className="h-4 w-4 text-text-faint" />
      <span
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
    </div>
  );
}

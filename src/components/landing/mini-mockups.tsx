import {
  CheckSquare,
  CalendarDays,
  Archive,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/** 自動延續 — 前幾天的區塊 mini mockup */
export function MiniContinue() {
  return (
    <div
      className="pointer-events-none select-none rounded-xl border border-border bg-background overflow-hidden p-4 mb-5"
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5 text-xs text-primary mb-2 font-medium">
        <CheckSquare className="h-3.5 w-3.5" />
        <span>前幾天的 (2)</span>
      </div>
      <MiniTaskRow title="繳水電費" dateLabel="4/5" />
      <MiniTaskRow title="回覆客戶 Email" dateLabel="4/7" />
    </div>
  );
}

/** 重新排程 — 迷你日曆 mockup */
export function MiniReschedule() {
  // 日曆樣式：4 月部分行，highlight 今天 (10) 跟選中 (15)
  const days = [
    [null, null, null, 1, 2, 3, 4],
    [5, 6, 7, 8, 9, 10, 11],
    [12, 13, 14, 15, 16, 17, 18],
  ];

  return (
    <div
      className="pointer-events-none select-none rounded-xl border border-border bg-background overflow-hidden p-4 mb-5"
      aria-hidden="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5 text-xs">
        <ChevronLeft className="h-3 w-3 text-text-dim" />
        <span className="font-medium text-foreground">2026 年 4 月</span>
        <ChevronRight className="h-3 w-3 text-text-dim" />
      </div>
      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1 mb-1 text-[9px] text-text-dim text-center">
        {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      {/* Days */}
      <div className="space-y-1">
        {days.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => {
              if (day === null) {
                return <div key={di} className="h-5" />;
              }
              const isToday = day === 10;
              const isSelected = day === 15;
              return (
                <div
                  key={di}
                  className={`h-5 flex items-center justify-center text-[10px] rounded tabular-nums ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-bold"
                      : isToday
                        ? "text-primary font-bold"
                        : "text-foreground"
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 任務狀態 — 五色狀態清單 mockup */
export function MiniStatuses() {
  const statuses = [
    { label: "暫記", color: "#9b9080" },
    { label: "待排入", color: "#7a8b9c" },
    { label: "處理中", color: "#c89968" },
    { label: "等待他人", color: "#a78aaf" },
    { label: "完成", color: "#8aa57d" },
  ];

  return (
    <div
      className="pointer-events-none select-none rounded-xl border border-border bg-background overflow-hidden p-4 mb-5"
      aria-hidden="true"
    >
      <div className="space-y-2.5">
        {statuses.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-xs" style={{ color: s.color }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 內部小元件
function MiniTaskRow({
  title,
  dateLabel,
}: {
  title: string;
  dateLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="h-[14px] w-[14px] rounded-[3px] border-2 border-text-dim shrink-0" />
      <span className="flex-1 text-xs text-foreground truncate">{title}</span>
      <span className="text-[10px] text-text-dim tabular-nums">{dateLabel}</span>
      <CalendarDays className="h-3 w-3 text-text-faint" />
      <Archive className="h-3 w-3 text-text-faint" />
    </div>
  );
}

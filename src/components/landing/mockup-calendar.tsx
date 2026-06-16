import { ChevronLeft, ChevronRight, Video } from "lucide-react";

/** 純 CSS 的行事曆月檢視 mockup + 視訊會議事件 */
export function MockupCalendar() {
  const weeks = [
    [30, 31, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24, 25, 26],
  ];
  // 哪幾天有任務圓點
  const dots: Record<number, number> = { 7: 2, 9: 1, 10: 3, 14: 1, 15: 2, 22: 1 };
  const today = 10;

  return (
    <div
      className="pointer-events-none select-none rounded-2xl border border-border bg-[var(--surface)] overflow-hidden shadow-[0_24px_60px_-20px_rgba(28,27,24,0.18)]"
      aria-hidden="true"
    >
      <div className="p-6 md:p-8">
        {/* 檢視切換 segmented */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-sm">
            <ChevronLeft className="h-4 w-4 text-text-dim" />
            <span className="font-semibold text-foreground tabular-nums">
              2026 年 4 月
            </span>
            <ChevronRight className="h-4 w-4 text-text-dim" />
          </div>
          <div className="flex items-center gap-1 border border-border rounded-lg p-1 text-xs">
            <span className="px-2 py-1 rounded text-text-dim">日</span>
            <span className="px-2 py-1 rounded text-text-dim">週</span>
            <span className="px-2 py-1 rounded bg-primary text-primary-foreground font-medium">
              月
            </span>
          </div>
        </div>

        {/* weekday labels */}
        <div className="grid grid-cols-7 gap-1 mb-1 text-[11px] text-text-dim text-center">
          {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* 月格 */}
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day, di) => {
                const muted = wi === 0 && day > 20;
                const isToday = day === today && !muted;
                return (
                  <div
                    key={di}
                    className={`h-12 rounded-lg border p-1 text-[11px] tabular-nums ${
                      isToday
                        ? "border-primary/50 bg-primary/5"
                        : "border-transparent"
                    }`}
                  >
                    <span
                      className={
                        isToday
                          ? "text-primary font-bold"
                          : muted
                            ? "text-text-faint"
                            : "text-foreground"
                      }
                    >
                      {day}
                    </span>
                    {!muted && dots[day] ? (
                      <span className="mt-1 flex gap-0.5">
                        {Array.from({ length: dots[day] }).map((_, i) => (
                          <span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-primary/60"
                          />
                        ))}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* 視訊會議事件列 */}
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-background p-3">
          <span className="h-9 w-1 rounded-full bg-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">
              團隊週會
            </div>
            <div className="text-xs text-text-dim tabular-nums">
              今天 10:00 – 10:30
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5">
            <Video className="h-3.5 w-3.5" />
            加入視訊
          </span>
        </div>
      </div>
    </div>
  );
}

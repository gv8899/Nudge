import { CheckSquare, FileText, CalendarDays } from "lucide-react";

/**
 * Mac 主視覺：一個畫面同時安排任務（左）+ 右側可切換行事曆／卡片。
 * 純 CSS 示意，之後可換真實 Mac 分割畫面截圖。
 */
export function MockupWorkspace() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-5 text-left" aria-hidden="true">
      {/* 左：今日任務 */}
      <div className="rounded-xl border border-border bg-[var(--surface)] p-5">
        <div className="text-xs text-primary font-medium mb-1">Friday</div>
        <div className="text-lg font-semibold text-foreground tabular-nums mb-4">
          4/10, 2026
        </div>
        <div className="flex items-center gap-2 text-xs text-primary mb-1.5">
          <CheckSquare className="h-3.5 w-3.5" />
          <span className="font-medium">前幾天的 (2)</span>
        </div>
        <WsTask title="繳水電費" date="4/5" />
        <WsTask title="回覆客戶 Email" date="4/7" />
        <div className="h-2" />
        <WsTask title="早晨運動" checked />
        <WsTask title="寫週報" />
        <WsTask title="準備簡報" />
        <WsTask title="閱讀 1 章" />
      </div>

      {/* 右：可切換行事曆／卡片 */}
      <div className="rounded-xl border border-border bg-[var(--surface)] p-5">
        {/* segmented */}
        <div className="flex items-center gap-1 border border-border rounded-lg p-1 text-xs mb-4">
          <span className="flex-1 text-center px-2 py-1 rounded bg-primary text-primary-foreground font-medium">
            行事曆
          </span>
          <span className="flex-1 text-center px-2 py-1 rounded text-text-dim">
            卡片
          </span>
        </div>
        {/* mini 月格 */}
        <div className="grid grid-cols-7 gap-1 mb-1 text-[9px] text-text-dim text-center">
          {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="space-y-1">
          {[
            [6, 7, 8, 9, 10, 11, 12],
            [13, 14, 15, 16, 17, 18, 19],
            [20, 21, 22, 23, 24, 25, 26],
          ].map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day) => {
                const isToday = day === 10;
                return (
                  <div
                    key={day}
                    className={`h-7 flex items-center justify-center text-[10px] rounded tabular-nums ${
                      isToday
                        ? "bg-primary text-primary-foreground font-bold"
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
        {/* 事件 */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background p-2.5">
          <span className="h-7 w-1 rounded-full bg-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-foreground truncate">
              團隊週會
            </div>
            <div className="text-[10px] text-text-dim tabular-nums">
              10:00 – 10:30
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WsTask({
  title,
  checked = false,
  date,
}: {
  title: string;
  checked?: boolean;
  date?: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div
        className={`h-[16px] w-[16px] rounded-[4px] border-2 flex items-center justify-center shrink-0 ${
          checked ? "bg-primary border-primary" : "border-text-dim"
        }`}
      >
        {checked && (
          <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
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
        className={`flex-1 text-sm truncate ${
          checked ? "line-through text-text-dim" : "text-foreground"
        }`}
      >
        {title}
      </span>
      {date && (
        <span className="text-[10px] text-text-dim tabular-nums">{date}</span>
      )}
      <FileText className="h-3.5 w-3.5 text-text-faint" />
      <CalendarDays className="h-3.5 w-3.5 text-text-faint" />
    </div>
  );
}

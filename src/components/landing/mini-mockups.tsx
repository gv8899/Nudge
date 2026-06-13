import { CheckSquare, CalendarDays, Archive, Repeat, Bell } from "lucide-react";

/** 自動延續 — 前幾天的區塊 mini mockup */
export function MiniContinue() {
  return (
    <div
      className="pointer-events-none select-none rounded-xl border border-border bg-[var(--surface)] overflow-hidden p-4 mb-5"
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

/** 重複任務 — 例行事規則 mini mockup */
export function MiniRecurrence() {
  const rules = [
    { title: "寫週報", rule: "每週五" },
    { title: "晨間站會", rule: "每週一至五" },
    { title: "繳房租", rule: "每月 1 日" },
  ];
  return (
    <div
      className="pointer-events-none select-none rounded-xl border border-border bg-[var(--surface)] overflow-hidden p-4 mb-5"
      aria-hidden="true"
    >
      <div className="space-y-2.5">
        {rules.map((r) => (
          <div key={r.title} className="flex items-center gap-2.5">
            <Repeat className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="flex-1 text-xs text-foreground truncate">
              {r.title}
            </span>
            <span className="text-[10px] text-text-dim border border-border rounded px-1.5 py-0.5">
              {r.rule}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 自訂推播通知 — 提醒卡片 mini mockup */
export function MiniPush() {
  return (
    <div
      className="pointer-events-none select-none rounded-xl border border-border bg-[var(--surface)] overflow-hidden p-4 mb-5"
      aria-hidden="true"
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary shrink-0">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Nudge</span>
            <span className="text-[10px] text-text-dim tabular-nums">09:00</span>
          </div>
          <p className="mt-0.5 text-xs text-text-dim truncate">
            提醒：交季度簡報初稿
          </p>
        </div>
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

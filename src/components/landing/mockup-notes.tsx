/** 純 CSS 的 Notes 頁時間軸 mockup */
export function MockupNotes() {
  return (
    <div
      className="pointer-events-none select-none rounded-2xl border border-border bg-background overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]"
      aria-hidden="true"
    >
      <div className="p-8">
        <div className="text-xl font-bold text-foreground mb-6">日誌</div>

        <NoteEntry
          dayNum={10}
          monthLabel="4 月"
          weekdayLabel="今天"
          isToday
          lines={[
            "早上去跑了 5 公里。久沒動了，膝蓋提醒我要重新適應。",
            "晚上吃得清淡一點，意外地比想像中舒服。",
          ]}
        />
        <NoteEntry
          dayNum={9}
          monthLabel="4 月"
          weekdayLabel="週三"
          lines={[
            "會議很多，但意外談出了下季的方向。",
            "重點不是開多少會，是有沒有留下可以行動的結論。",
          ]}
        />
        <NoteEntry
          dayNum={8}
          monthLabel="4 月"
          weekdayLabel="週二"
          isLast
          lines={[
            "讀了一篇關於「慢下來反而走得更遠」的文章。",
            "很多時候我以為是生產力問題，其實是注意力問題。",
          ]}
        />
      </div>
    </div>
  );
}

function NoteEntry({
  dayNum,
  monthLabel,
  weekdayLabel,
  isToday = false,
  isLast = false,
  lines,
}: {
  dayNum: number;
  monthLabel: string;
  weekdayLabel: string;
  isToday?: boolean;
  isLast?: boolean;
  lines: string[];
}) {
  return (
    <div className="relative pl-16 pb-6">
      {/* timeline column */}
      <div className="absolute left-5 top-0 bottom-0 w-3 flex flex-col items-center">
        {!isToday && <div className="h-[18px] w-px bg-border" />}
        {isToday && <div className="h-3" />}
        <div
          className={`h-3 w-3 rounded-full bg-primary shrink-0 ${
            isToday ? "ring-4 ring-primary/15" : ""
          }`}
        />
        {!isLast && <div className="flex-1 w-px bg-border" />}
      </div>

      {/* header */}
      <header className="flex items-center gap-3 mb-3">
        <span className="text-[2.25rem] font-black text-primary tabular-nums leading-none tracking-tight">
          {dayNum}
        </span>
        <div className="self-stretch w-px bg-primary/25 my-1" />
        <div className="flex flex-col gap-1 text-[10px] font-bold tracking-[0.18em] uppercase leading-none">
          <span className="text-foreground/75">{monthLabel}</span>
          <span className={isToday ? "text-primary" : "text-text-dim"}>
            {weekdayLabel}
          </span>
        </div>
      </header>

      {/* content */}
      <div className="text-sm text-muted-foreground space-y-1">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}

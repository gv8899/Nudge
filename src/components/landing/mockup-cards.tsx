import { Plus, Search, List, LayoutGrid } from "lucide-react";

/** 純 CSS 的 Cards 頁 list 模式 mockup */
export function MockupCards() {
  const items = [
    {
      title: "研究 Tailwind v4",
      preview: "新功能：@theme inline 把 CSS 變數註冊為 Tailwind token。Build 速度顯著變快。",
      date: "4/3",
      status: { label: "完成", color: "#8aa57d" },
    },
    {
      title: "產品設計：減法的力量",
      preview: "讀完 Subtract 第 2 章。人類天生傾向加東西，但主動減東西往往效果更好。",
      date: "4/6",
      status: { label: "處理中", color: "#c89968" },
    },
    {
      title: "色彩心理學筆記",
      preview: "沉香木 #c89968 介於橘與棕之間，給人日記本的溫度但不過於激烈。",
      date: "4/8",
      status: { label: "處理中", color: "#c89968" },
    },
    {
      title: "為什麼 nudge 不做通知",
      preview: "市面上的 todo app 都在比誰更會打擾你。我想做的是反向的。",
      date: "4/9",
      status: { label: "處理中", color: "#c89968" },
    },
  ];

  return (
    <div
      className="pointer-events-none select-none rounded-2xl border border-border bg-background overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]"
      aria-hidden="true"
    >
      <div className="p-8">
        {/* header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-foreground">卡片</h3>
            <div className="flex items-center justify-center h-8 w-8 rounded-lg text-primary">
              <Plus className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border border-border rounded-lg p-1">
              <div className="p-1.5 rounded bg-muted text-foreground">
                <List className="h-4 w-4" />
              </div>
              <div className="p-1.5 rounded text-text-dim">
                <LayoutGrid className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
          <div className="w-full pl-10 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-text-faint">
            搜尋卡片...
          </div>
        </div>

        {/* list */}
        <div className="divide-y divide-border">
          {items.map((item, i) => (
            <div key={i} className="py-3 px-2 -mx-2">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs text-text-dim line-clamp-2">
                    {item.preview}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-xs text-text-dim tabular-nums">
                    {item.date}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded border"
                    style={{
                      color: item.status.color,
                      borderColor: item.status.color,
                    }}
                  >
                    {item.status.label}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

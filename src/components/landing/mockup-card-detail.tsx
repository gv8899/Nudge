import { ArrowLeft } from "lucide-react";

/** 純 CSS 的卡片詳細頁 mockup，展示 markdown render 元素 */
export function MockupCardDetail() {
  return (
    <div
      className="pointer-events-none select-none rounded-2xl border border-border bg-[var(--surface)] overflow-hidden shadow-[0_24px_60px_-20px_rgba(28,27,24,0.18)]"
      aria-hidden="true"
    >
      <div className="p-8">
        {/* 返回連結 */}
        <div className="inline-flex items-center gap-1 text-xs text-text-dim mb-6">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回卡片
        </div>

        {/* Header */}
        <header className="mb-6 pb-4 border-b border-border">
          <h1 className="text-2xl font-bold text-foreground tracking-tight mb-3">
            產品設計：減法的力量
          </h1>
          <div className="flex items-center gap-2 text-[11px] text-text-dim">
            <span>建立 2026/04/05</span>
            <span>·</span>
            <span>更新 2026/04/06</span>
            <span>·</span>
            <span
              className="px-1.5 py-0.5 rounded border text-[10px]"
              style={{
                color: "#c89968",
                borderColor: "#c89968",
                backgroundColor: "rgba(200,153,104,0.1)",
              }}
            >
              處理中
            </span>
          </div>
        </header>

        {/* Markdown 內容 */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            讀完《<em className="text-muted-foreground">Subtract</em>》第 2 章，幾個重點：
          </p>

          <blockquote className="border-l-2 border-primary/60 pl-3 py-1 text-sm text-muted-foreground italic">
            人類天生傾向「加東西」來解決問題，但研究顯示主動「減東西」往往效果更好。
          </blockquote>

          <h3 className="text-base font-semibold text-foreground mt-4">
            對 nudge 的啟發
          </h3>

          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>不要為了「完整性」加功能</li>
            <li>
              <strong className="text-foreground font-semibold">YAGNI</strong>{" "}
              不只是工程原則，也是產品原則
            </li>
            <li>每個功能都要問：刪掉會怎樣？</li>
          </ul>

          <h3 className="text-base font-semibold text-foreground mt-4">
            程式碼小技巧
          </h3>

          <p className="text-sm text-muted-foreground leading-relaxed">
            用{" "}
            <code className="bg-border px-1.5 py-0.5 rounded text-primary text-xs">
              color-mix()
            </code>{" "}
            可以用一個變數產生半透明版本，省下一組 token。
          </p>
        </div>
      </div>
    </div>
  );
}

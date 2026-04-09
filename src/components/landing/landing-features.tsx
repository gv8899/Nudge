import { MockupTasks } from "./mockup-tasks";
import { MockupNotes } from "./mockup-notes";
import { MockupCards } from "./mockup-cards";
import { MockupCardDetail } from "./mockup-card-detail";
import {
  MiniContinue,
  MiniReschedule,
  MiniStatuses,
} from "./mini-mockups";

export function LandingFeatures() {
  return (
    <>
      {/* 行動 — 置中佈局 */}
      <section className="py-24 md:py-32 px-6 md:px-12 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-6">
              行動
            </div>
            <h2 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-[-0.035em] max-w-[900px] mx-auto mb-6">
              專注在
              <br />
              今天要做的事
            </h2>
            <p className="text-lg md:text-xl text-text-dim max-w-[600px] mx-auto leading-relaxed">
              每日任務清單。不多、不雜，就是今天能推進的事。
            </p>
          </div>

          {/* 產品 mockup */}
          <div className="max-w-[720px] mx-auto mb-20">
            <MockupTasks />
          </div>

          {/* 三個子功能強調 — 每個功能一列，左右交錯 */}
          <div className="max-w-[1000px] mx-auto space-y-20 md:space-y-28">
            {/* 01 自動延續 — 左文右圖 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div>
                <div className="flex items-baseline gap-4 mb-6">
                  <span className="text-7xl md:text-8xl font-black text-primary leading-none tabular-nums tracking-[-0.04em]">
                    01
                  </span>
                  <span className="h-px flex-1 bg-primary/30 self-center" />
                </div>
                <h3 className="text-4xl md:text-5xl font-black text-foreground leading-[0.95] tracking-[-0.03em] mb-6">
                  自動延續
                </h3>
                <p className="text-lg text-text-dim leading-relaxed max-w-[420px]">
                  沒做完的任務不會消失。隔天打開時，會出現在頁首讓你繼續處理。
                </p>
              </div>
              <div>
                <MiniContinue />
              </div>
            </div>

            {/* 02 重新排程 — 右文左圖 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div className="md:order-2">
                <div className="flex items-baseline gap-4 mb-6">
                  <span className="text-7xl md:text-8xl font-black text-primary leading-none tabular-nums tracking-[-0.04em]">
                    02
                  </span>
                  <span className="h-px flex-1 bg-primary/30 self-center" />
                </div>
                <h3 className="text-4xl md:text-5xl font-black text-foreground leading-[0.95] tracking-[-0.03em] mb-6">
                  重新排程
                </h3>
                <p className="text-lg text-text-dim leading-relaxed max-w-[420px]">
                  一鍵排入今天，或從日曆挑一個更合適的日子。不需要的就封存。
                </p>
              </div>
              <div className="md:order-1">
                <MiniReschedule />
              </div>
            </div>

            {/* 03 任務狀態 — 左文右圖 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div>
                <div className="flex items-baseline gap-4 mb-6">
                  <span className="text-7xl md:text-8xl font-black text-primary leading-none tabular-nums tracking-[-0.04em]">
                    03
                  </span>
                  <span className="h-px flex-1 bg-primary/30 self-center" />
                </div>
                <h3 className="text-4xl md:text-5xl font-black text-foreground leading-[0.95] tracking-[-0.03em] mb-6">
                  任務狀態
                </h3>
                <p className="text-lg text-text-dim leading-relaxed max-w-[420px]">
                  暫記、待排入、處理中、等待他人、完成。用顏色分類，一眼看出每個任務在哪一步。
                </p>
              </div>
              <div>
                <MiniStatuses />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 日誌 — alt 左文右圖 */}
      <section className="py-24 md:py-32 px-6 md:px-12 border-t border-border">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-6">
              日誌
            </div>
            <h2 className="text-5xl md:text-6xl font-black leading-[0.95] tracking-[-0.035em] mb-6">
              紀錄
              <br />
              每一個當下
            </h2>
            <p className="text-lg md:text-xl text-text-dim leading-relaxed">
              在任務旁邊隨手寫幾句。日復一日，就成了你自己的日記。
            </p>
          </div>
          <div>
            <MockupNotes />
          </div>
        </div>
      </section>

      {/* 卡片 — 置中佈局 */}
      <section className="py-24 md:py-32 px-6 md:px-12 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-6">
              卡片
            </div>
            <h2 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-[-0.035em] max-w-[900px] mx-auto mb-6">
              留下
              <br />
              工作與生活的痕跡
            </h2>
            <p className="text-lg md:text-xl text-text-dim max-w-[640px] mx-auto leading-relaxed">
              會議決策、讀書心得、旅行計畫、運動紀錄 —
              <br className="hidden md:inline" />
              有內容的任務都會被留下來，要找的時候，它就在那裡。
            </p>
          </div>
          <div className="max-w-[720px] mx-auto mb-12">
            <MockupCards />
          </div>
          {/* 單頁卡片 — 展示 markdown 內容 */}
          <div className="max-w-[720px] mx-auto">
            <MockupCardDetail />
          </div>
        </div>
      </section>
    </>
  );
}

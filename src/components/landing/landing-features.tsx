import { MockupTasks } from "./mockup-tasks";
import { MockupNotes } from "./mockup-notes";
import { MockupCards } from "./mockup-cards";

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
              每日任務清單，不多不少，剛好是你今天能推進的量。
            </p>
          </div>
          <div className="max-w-[720px] mx-auto">
            <MockupTasks />
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
              在任務旁邊寫下感受，累積成時間軸式的個人日記。
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
              回顧
              <br />
              你的 second brain
            </h2>
            <p className="text-lg md:text-xl text-text-dim max-w-[600px] mx-auto leading-relaxed">
              有內容的任務自動變成可搜尋的卡片。未來翻找時一次攤開所有脈絡。
            </p>
          </div>
          <div className="max-w-[720px] mx-auto">
            <MockupCards />
          </div>
        </div>
      </section>
    </>
  );
}
